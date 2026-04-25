const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

class AuthService {
  constructor() {
    this.userService = null;
    this.refreshTokens = new Map();
  }

  async initialize() {
    const userService = require("./user.service");
    this.userService = userService;
    await this.userService.initialize();
    console.log("AuthService initialized");
  }

  _generateAccessToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const expiresIn = process.env.JWT_EXPIRES_IN || "1d";
    return jwt.sign(payload, secret, { expiresIn });
  }

  _generateRefreshToken() {
    return crypto.randomBytes(40).toString("hex");
  }

  _storeRefreshToken(userId, token) {
    this.refreshTokens.set(token, { userId, createdAt: Date.now() });
  }

  _validateRefreshToken(token) {
    const record = this.refreshTokens.get(token);
    if (!record) return null;
    if (Date.now() - record.createdAt > 7 * 24 * 60 * 60 * 1000) {
      this.refreshTokens.delete(token);
      return null;
    }
    return record.userId;
  }

  _revokeRefreshToken(token) {
    this.refreshTokens.delete(token);
  }

  // ------------------------------------------------------------------
  // Public methods (with optional transaction support)
  // ------------------------------------------------------------------

  /**
   * Register a new user
   * @param {Object} data
   * @param {Object} user - the acting user (may be system)
   * @param {Object} queryRunner - optional transaction runner
   */
  async register(data, user = { id: "system" }, queryRunner = null) {
    const createdUser = await this.userService.create(data, user, queryRunner);
    const accessToken = this._generateAccessToken(createdUser);
    const refreshToken = this._generateRefreshToken();
    this._storeRefreshToken(createdUser.id, refreshToken);
    return { user: createdUser, accessToken, refreshToken };
  }

  /**
   * Login user
   * @param {string} identifier
   * @param {string} password
   */
  async login(identifier, password) {
    if (!this.userService) await this.initialize();

    const fullUser = await this.userService.findByIdentifier(identifier);
    if (!fullUser) throw new Error("Invalid credentials");
    if (!fullUser.is_active) throw new Error("Account is disabled");

    const isValid = await bcrypt.compare(password, fullUser.password_hash);
    if (!isValid) throw new Error("Invalid credentials");

    // Update last login (no transaction needed for simple update, but we can still use user object)
    const { password_hash, ...safeUser } = fullUser;
    await this.userService.update(
      fullUser.id,
      { lastLoginAt: new Date() },
      safeUser
    );

    const accessToken = this._generateAccessToken(safeUser);
    const refreshToken = this._generateRefreshToken();
    this._storeRefreshToken(fullUser.id, refreshToken);
    return { user: safeUser, accessToken, refreshToken };
  }

  async refreshToken(refreshToken) {
    const userId = this._validateRefreshToken(refreshToken);
    if (!userId) throw new Error("Invalid or expired refresh token");

    const user = await this.userService.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.is_active) throw new Error("Account is disabled");

    const newAccessToken = this._generateAccessToken(user);
    const newRefreshToken = this._generateRefreshToken();
    this._revokeRefreshToken(refreshToken);
    this._storeRefreshToken(userId, newRefreshToken);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken) {
    if (refreshToken) this._revokeRefreshToken(refreshToken);
    return { success: true };
  }

  async changePassword(userId, oldPassword, newPassword, currentUser) {
    // Get full user with password hash
    const repo = (await this.userService.getRepositories()).user;
    const fullUser = await repo.findOne({ where: { id: userId } });
    if (!fullUser) throw new Error("User not found");

    const isValid = await bcrypt.compare(oldPassword, fullUser.password_hash);
    if (!isValid) throw new Error("Current password is incorrect");

    await this.userService.update(
      userId,
      { password: newPassword },
      currentUser
    );
    return { success: true };
  }
}

const authService = new AuthService();
module.exports = authService;
