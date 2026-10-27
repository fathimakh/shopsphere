import { boolean, email, password, text } from './rules.js';

export const registerRules = {
  name: text({ label: 'Name', min: 2, max: 50 }),
  email: email(),
  password: password(),
};

// Strength rules are not re-applied on login; a wrong password is simply a 401.
export const loginRules = {
  email: email(),
  password: text({ label: 'Password', max: 128 }),
};

export const logoutRules = {
  allDevices: boolean({ label: 'allDevices' }),
};
