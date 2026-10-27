import { CONTACT_STATUSES } from '../models/contactMessage.js';
import { email, oneOf, text } from './rules.js';

export const contactRules = {
  name: text({ label: 'Name', min: 2, max: 60 }),
  email: email(),
  subject: text({ label: 'Subject', min: 3, max: 120 }),
  message: text({ label: 'Message', min: 10, max: 2000 }),
};

export const contactStatusRules = {
  status: oneOf({ label: 'Status', values: CONTACT_STATUSES }),
};
