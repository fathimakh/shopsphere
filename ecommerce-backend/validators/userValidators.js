import { USER_ROLES } from '../models/user.js';
import { PHONE_PATTERN, arrayOf, email, number, object, oneOf, password, text } from './rules.js';

export const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{2,10}$/;

const addressRules = {
  street: text({ label: 'Street', max: 120, required: false }),
  city: text({ label: 'City', max: 60, required: false }),
  state: text({ label: 'State', max: 60, required: false }),
  postalCode: text({
    label: 'Postal code',
    max: 12,
    required: false,
    pattern: POSTAL_CODE_PATTERN,
    patternMessage: 'Postal code is invalid',
  }),
  country: text({ label: 'Country', max: 60, required: false }),
};

// Used with { partial: true }: send only the fields you want to change.
export const updateProfileRules = {
  name: text({ label: 'Name', min: 2, max: 50 }),
  email: email(),
  phone: text({ label: 'Phone', max: 20, required: false, pattern: PHONE_PATTERN, patternMessage: 'Phone number is invalid' }),
  address: object({ label: 'Address', fields: addressRules, required: false }),
};

export const changePasswordRules = {
  currentPassword: text({ label: 'Current password', max: 128 }),
  newPassword: password({ label: 'New password' }),
};

export const deleteAccountRules = {
  password: text({ label: 'Password', max: 128 }),
};

// Unknown or malformed product ids are dropped by the controller (not rejected).
export const saveCartRules = {
  items: arrayOf({
    label: 'Items',
    minItems: 0,
    maxItems: 50,
    fields: {
      product: text({ label: 'Product', max: 64 }),
      quantity: number({ label: 'Quantity', min: 1, max: 1000, integer: true }),
    },
  }),
};

export const adminUpdateUserRules = {
  name: text({ label: 'Name', min: 2, max: 50 }),
  email: email(),
  role: oneOf({ label: 'Role', values: USER_ROLES }),
};
