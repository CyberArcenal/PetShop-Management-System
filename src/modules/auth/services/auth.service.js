//@ts-check
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class AuthService {
  constructor() {
    this.userService = null;
    this.refreshTokens = new Map(); // In-memory store; replace with DB table later
  }

  async initialize() {
    const userService = require('./user.service');
    this.userService = userService;
    await this.userService.initialize();
    console.log('AuthService initialized');
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  _generateAccessToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    return jwt.sign(payload, secret, { expiresIn });
  }

  _generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  _storeRefreshToken(userId, token) {
    this.refreshTokens.set(token, { userId, createdAt: Date.now() });
    // In production: save to database with expiry
  }

  _validateRefreshToken(token) {
    const record = this.refreshTokens.get(token);
    if (!record) return null;
    // Optionally check expiry (e.g., 7 days)
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
  // Public methods
  // ------------------------------------------------------------------

  /**
   * Register a new user (creates user account automatically)
   * @param {Object} data
   */
  async register(data) {
    // Use userService.create
    const user = await this.userService.create(data, 'system');
    const accessToken = this._generateAccessToken(user);
    const refreshToken = this._generateRefreshToken();
    this._storeRefreshToken(user.id, refreshToken);
    return { user, accessToken, refreshToken };
  }

  /**
   * Login user
   * @param {string} identifier - username or email
   * @param {string} password
   */
  async login(identifier, password) {
    if (!this.userService) await this.initialize();

    const user = await this.userService.findByIdentifier(identifier);
    if (!user) throw new Error('Invalid credentials');
    if (!user.is_active) throw new Error('Account is disabled');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Invalid credentials');

    // Update last login time (optional)
    await this.userService.update(user.id, { lastLoginAt: new Date() }, 'system');

    const { password_hash, ...safeUser } = user;
    const accessToken = this._generateAccessToken(safeUser);
    const refreshToken = this._generateRefreshToken();
    this._storeRefreshToken(user.id, refreshToken);
    return { user: safeUser, accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken
   */
  async refreshToken(refreshToken) {
    const userId = this._validateRefreshToken(refreshToken);
    if (!userId) throw new Error('Invalid or expired refresh token');

    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.is_active) throw new Error('Account is disabled');

    const newAccessToken = this._generateAccessToken(user);
    // Optionally rotate refresh token (issue new one, revoke old)
    const newRefreshToken = this._generateRefreshToken();
    this._revokeRefreshToken(refreshToken);
    this._storeRefreshToken(userId, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout – revoke refresh token
   * @param {string} refreshToken
   */
  async logout(refreshToken) {
    if (refreshToken) {
      this._revokeRefreshToken(refreshToken);
    }
    return { success: true };
  }

  /**
   * Change password
   * @param {number} userId
   * @param {string} oldPassword
   * @param {string} newPassword
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await this.userService.findByIdentifier(userId); // need method to get user with hash
    // We'll retrieve full user including password_hash
    const { user: repo } = await this.userService.getRepositories();
    const fullUser = await repo.findOne({ where: { id: userId } });
    if (!fullUser) throw new Error('User not found');

    const isValid = await bcrypt.compare(oldPassword, fullUser.password_hash);
    if (!isValid) throw new Error('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userService.update(userId, { password: newPassword }, 'system'); // userService.update handles hashing
    return { success: true };
  }
}

const authService = new AuthService();
module.exports = authService;