import { ORDER_STATUSES, PAYMENT_METHODS } from '../models/order.js';
import { PHONE_PATTERN, arrayOf, number, object, objectId, oneOf, text } from './rules.js';
import { POSTAL_CODE_PATTERN } from './userValidators.js';

const shippingAddressRules = {
  fullName: text({ label: 'Full name', min: 2, max: 60 }),
  phone: text({ label: 'Phone', max: 20, pattern: PHONE_PATTERN, patternMessage: 'Phone number is invalid' }),
  street: text({ label: 'Street', min: 3, max: 120 }),
  city: text({ label: 'City', min: 2, max: 60 }),
  state: text({ label: 'State', min: 2, max: 60 }),
  postalCode: text({ label: 'Postal code', max: 12, pattern: POSTAL_CODE_PATTERN, patternMessage: 'Postal code is invalid' }),
  country: text({ label: 'Country', max: 60, required: false }),
};

// Only product ids and quantities are accepted; names and prices always come from the database.
export const createOrderRules = {
  items: arrayOf({
    label: 'Items',
    maxItems: 50,
    fields: {
      product: objectId({ label: 'Product' }),
      quantity: number({ label: 'Quantity', min: 1, max: 100, integer: true }),
    },
  }),
  shippingAddress: object({ label: 'Shipping address', fields: shippingAddressRules }),
  paymentMethod: oneOf({ label: 'Payment method', values: PAYMENT_METHODS }),
};

export const updateOrderStatusRules = {
  status: oneOf({ label: 'Status', values: ORDER_STATUSES }),
  note: text({ label: 'Note', max: 200, required: false }),
};
