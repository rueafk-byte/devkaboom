const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// Wallet address validation
const walletAddressValidation = [
    param('walletAddress')
        .isLength({ min: 32, max: 44 })
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana wallet address format'),
    validateRequest
];

// Player creation validation
const createPlayerValidation = [
    body('wallet_address')
        .isLength({ min: 32, max: 44 })
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana wallet address format'),
    body('username')
        .isLength({ min: 3, max: 20 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-20 characters, alphanumeric, underscore, or dash only'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    body('level')
        .optional()
        .isInt({ min: 1, max: 40 })
        .withMessage('Level must be between 1 and 40'),
    body('total_score')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Total score must be non-negative'),
    body('boom_tokens')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Boom tokens must be non-negative'),
    body('lives')
        .optional()
        .isInt({ min: 0, max: 5 })
        .withMessage('Lives must be between 0 and 5'),
    validateRequest
];

// Player update validation
const updatePlayerValidation = [
    ...walletAddressValidation.slice(0, -1), // Remove validateRequest from walletAddressValidation
    body('username')
        .optional()
        .isLength({ min: 3, max: 20 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-20 characters, alphanumeric, underscore, or dash only'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    body('level')
        .optional()
        .isInt({ min: 1, max: 40 })
        .withMessage('Level must be between 1 and 40'),
    body('total_score')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Total score must be non-negative'),
    body('current_score')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Current score must be non-negative'),
    body('boom_tokens')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Boom tokens must be non-negative'),
    body('lives')
        .optional()
        .isInt({ min: 0, max: 5 })
        .withMessage('Lives must be between 0 and 5'),
    body('experience_points')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Experience points must be non-negative'),
    body('preferred_difficulty')
        .optional()
        .isIn(['easy', 'normal', 'hard', 'expert'])
        .withMessage('Difficulty must be easy, normal, hard, or expert'),
    validateRequest
];

// Game session validation
const createSessionValidation = [
    body('session_id')
        .isLength({ min: 10, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Session ID must be 10-50 characters, alphanumeric, underscore, or dash only'),
    body('wallet_address')
        .isLength({ min: 32, max: 44 })
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana wallet address format'),
    body('session_type')
        .optional()
        .isIn(['pve', 'pvp', 'tutorial', 'challenge'])
        .withMessage('Session type must be pve, pvp, tutorial, or challenge'),
    body('device_type')
        .optional()
        .isIn(['desktop', 'mobile', 'tablet'])
        .withMessage('Device type must be desktop, mobile, or tablet'),
    validateRequest
];

// Session update validation
const updateSessionValidation = [
    param('sessionId')
        .isLength({ min: 10, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Session ID must be 10-50 characters, alphanumeric, underscore, or dash only'),
    body('levels_attempted')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Levels attempted must be non-negative'),
    body('levels_completed')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Levels completed must be non-negative'),
    body('score_earned')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Score earned must be non-negative'),
    body('tokens_earned')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Tokens earned must be non-negative'),
    body('enemies_killed')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Enemies killed must be non-negative'),
    body('bombs_used')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Bombs used must be non-negative'),
    body('deaths')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Deaths must be non-negative'),
    body('achievements_unlocked')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Achievements unlocked must be non-negative'),
    body('highest_level_reached')
        .optional()
        .isInt({ min: 1, max: 40 })
        .withMessage('Highest level reached must be between 1 and 40'),
    validateRequest
];

// Recharge validation
const rechargeValidation = [
    ...walletAddressValidation.slice(0, -1), // Remove validateRequest
    body('lives_remaining')
        .optional()
        .isInt({ min: 0, max: 5 })
        .withMessage('Lives remaining must be between 0 and 5'),
    body('cooldown_duration_minutes')
        .optional()
        .isInt({ min: 1, max: 1440 })
        .withMessage('Cooldown duration must be between 1 and 1440 minutes'),
    validateRequest
];

// Token transaction validation
const tokenTransactionValidation = [
    body('wallet_address')
        .isLength({ min: 32, max: 44 })
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana wallet address format'),
    body('transaction_type')
        .isIn(['earned', 'spent', 'transferred', 'bonus', 'penalty'])
        .withMessage('Transaction type must be earned, spent, transferred, bonus, or penalty'),
    body('amount')
        .isFloat({ min: 0.00000001 })
        .withMessage('Amount must be positive'),
    body('source')
        .isIn(['level_completion', 'achievement', 'daily_bonus', 'referral', 'purchase', 'admin', 'penalty'])
        .withMessage('Invalid transaction source'),
    body('description')
        .isLength({ min: 1, max: 255 })
        .withMessage('Description must be 1-255 characters'),
    validateRequest
];

// Achievement validation
const achievementValidation = [
    body('achievement_key')
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-z0-9_]+$/)
        .withMessage('Achievement key must be 3-50 characters, lowercase, numbers, and underscores only'),
    body('name')
        .isLength({ min: 3, max: 100 })
        .withMessage('Achievement name must be 3-100 characters'),
    body('description')
        .isLength({ min: 10, max: 500 })
        .withMessage('Achievement description must be 10-500 characters'),
    body('category')
        .isIn(['gameplay', 'progression', 'social', 'special', 'seasonal'])
        .withMessage('Category must be gameplay, progression, social, special, or seasonal'),
    body('difficulty')
        .optional()
        .isIn(['easy', 'normal', 'hard', 'legendary'])
        .withMessage('Difficulty must be easy, normal, hard, or legendary'),
    body('reward_tokens')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Reward tokens must be non-negative'),
    body('reward_experience')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Reward experience must be non-negative'),
    validateRequest
];

// Search validation
const searchValidation = [
    query('q')
        .isLength({ min: 1, max: 100 })
        .trim()
        .escape()
        .withMessage('Search query must be 1-100 characters'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be non-negative'),
    validateRequest
];

// Pagination validation
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('sort')
        .optional()
        .isIn(['created_at', 'updated_at', 'total_score', 'level', 'boom_tokens', 'username'])
        .withMessage('Invalid sort field'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Order must be asc or desc'),
    validateRequest
];

// Admin action validation
const adminActionValidation = [
    body('action_type')
        .isIn(['create', 'update', 'delete', 'ban', 'unban', 'reset', 'grant_tokens', 'revoke_tokens', 'system'])
        .withMessage('Invalid action type'),
    body('target_wallet')
        .optional()
        .isLength({ min: 32, max: 44 })
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid target wallet address format'),
    body('action_details')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Action details must be 1-1000 characters'),
    body('reason')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Reason must be 1-500 characters'),
    body('severity')
        .optional()
        .isIn(['info', 'warning', 'error', 'critical'])
        .withMessage('Severity must be info, warning, error, or critical'),
    validateRequest
];

module.exports = {
    validateRequest,
    walletAddressValidation,
    createPlayerValidation,
    updatePlayerValidation,
    createSessionValidation,
    updateSessionValidation,
    rechargeValidation,
    tokenTransactionValidation,
    achievementValidation,
    searchValidation,
    paginationValidation,
    adminActionValidation
};
