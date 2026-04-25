

const { logger } = require("../common/utils/logger");
const { UserStateTransition } = require("../stateTransitionServices/user.state");

class UserSubscriber {
  constructor() {
    this.stateTransition = new UserStateTransition();
  }

  listenTo() {
    return 'User'; // the name defined in UserEntity
  }

  async beforeInsert(entity) {
    logger.info('[UserSubscriber] beforeInsert', { id: entity.id });
  }

  async afterInsert(entity) {
    logger.info('[UserSubscriber] afterInsert', { id: entity.id });
  }

  async beforeUpdate(entity) {
    logger.info('[UserSubscriber] beforeUpdate', { id: entity.id });
  }

  /** @param {{ databaseEntity?: any; entity: any }} event */
  async afterUpdate(event) {
    if (!event.entity) return;

    const oldUser = event.databaseEntity;
    const newUser = event.entity;

    if (!oldUser) {
      logger.warn('[UserSubscriber] afterUpdate: oldUser is missing', { id: newUser.id });
      return;
    }

    // 1. Check for login event (last_login_at changed)
    if (oldUser.last_login_at !== newUser.last_login_at && newUser.last_login_at) {
      await this.stateTransition.onLogin(newUser);
    }

    // 2. Check for activation/deactivation (is_active changed)
    if (oldUser.is_active !== newUser.is_active) {
      if (newUser.is_active) {
        await this.stateTransition.onActivated(newUser);
      } else {
        await this.stateTransition.onDeactivated(newUser);
      }
    }

    // 3. Check for password change (password_hash changed)
    if (oldUser.password_hash !== newUser.password_hash) {
      await this.stateTransition.onPasswordChanged(newUser);
    }

    // Note: you could also detect role changes, email changes, etc. as needed.
  }

  async beforeRemove(entity) {
    logger.info('[UserSubscriber] beforeRemove', { id: entity.id });
  }

  async afterRemove(event) {
    logger.info('[UserSubscriber] afterRemove', { id: event.entityId });
  }
}

module.exports = UserSubscriber;