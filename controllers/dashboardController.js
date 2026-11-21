const { getRecoveryCodeStats } = require('../services/recoveryCodeService');

/**
 * Display User Dashboard
 */
exports.getDashboard = (req, res) => {
  const user = req.user;
  const stats = getRecoveryCodeStats(user.recoveryCodes);

  res.render('dashboard/index', {
    title: 'Security Dashboard - 2FA Demo',
    user: {
      name: user.name,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    },
    recoveryStats: stats,
    sessionId: req.sessionID ? `${req.sessionID.substring(0, 8)}...` : 'Active',
  });
};
