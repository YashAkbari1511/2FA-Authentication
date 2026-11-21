const session = require('express-session');
const connectMongo = require('connect-mongo');

const MongoStore = connectMongo.MongoStore || connectMongo.default || connectMongo;

const createSessionMiddleware = () => {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/2fa_demo';
  const isProduction = process.env.NODE_ENV === 'production';

  return session({
    secret: process.env.SESSION_SECRET || 'fallback-insecure-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native',
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    name: 'session_id',
  });
};

module.exports = createSessionMiddleware;
