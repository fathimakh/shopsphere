import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/axiosInstance'
import FormField from '../FormField'
import ErrorMessage from '../ErrorMessage'
import AdminThumbnail from './AdminThumbnail'
import AdminDialog from './AdminDialog'
import useDebounce from '../../hooks/useDebounce'
import useAdminMutation from '../../hooks/useAdminMutation'
import useValidatedForm, { focusFirstInvalid } from '../../hooks/useValidatedForm'
import { formatCategory } from '../../utils/format'
import { LIMITS, parseImageList, validateProduct } from '../../utils/validators'

const NEW_CATEGORY = '__new__'
// Server limits that utils/validators doesn't cover (contract §3.4 / productValidators.js).
const MAX_IMAGES = 10
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 30
const MAX_CATEGORY_LENGTH = 50

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  mrp: '',
  category: '',
  brand: '',
  stock: '',
  images: '',
  tags: '',
  isFeatured: false,
}

function parseTags(value) {
  return [...new Set(String(value ?? '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

function toFormValues(product) {
  if (!product) return EMPTY_PRODUCT
  return {
    name: product.name ?? '',
    description: product.description ?? '',
    price: String(product.price ?? ''),
    mrp: product.mrp === null || product.mrp === undefined ? '' : String(product.mrp),
    category: product.category ?? '',
    brand: product.brand ?? '',
    stock: String(product.stock ?? ''),
    images: (product.images ?? []).join('\n'),
    tags: (product.tags ?? []).join(', '),
    isFeatured: Boolean(product.isFeatured),
  }
}

/** Shared product rules plus the list limits enforced by the API. */
function validateProductForm(values) {
  const errors = validateProduct(values)
  const category = values.category.trim()
  if (!errors.category && category.length < 2) errors.category = 'Category must be at least 2 characters'
  if (!errors.category && category.length > MAX_CATEGORY_LENGTH) {
    errors.category = `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer`
  }
  if (!errors.images && parseImageList(values.images).length > MAX_IMAGES) {
    errors.images = `Add at most ${MAX_IMAGES} image URLs`
  }
  const tags = parseTags(values.tags)
  if (tags.length > MAX_TAGS) errors.tags = `Use at most ${MAX_TAGS} tags`
  else if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) errors.tags = `Each tag must be ${MAX_TAG_LENGTH} characters or fewer`
  return errors
}

/** Form values → API body. Numbers are sent as numbers; empty optional fields are left out. */
function toPayload(values, product) {
  const payload = {
    name: values.name.trim(),
    description: values.description.trim(),
    price: Number(values.price),
    category: values.category.trim().toLowerCase(),
    stock: Number(values.stock),
    images: parseImageList(values.images),
    tags: parseTags(values.tags),
    isFeatured: values.isFeatured,
  }
  if (values.brand.trim()) payload.brand = values.brand.trim()
  if (values.mrp.trim() !== '') payload.mrp = Number(values.mrp)
  else if (product?.mrp !== undefined && product?.mrp !== null) payload.mrp = null // clears an existing MRP
  return payload
}

/**
 * Create / edit a product (POST /products, PUT /products/:id). Mount it only while open:
 * the form state is initialised from `product` (null = create).
 */
export default function ProductFormDialog({ product, categories = [], onClose, onSaved }) {
  const isEdit = Boolean(product)
  const formId = useId()
  const formRef = useRef(null)
  const { values, errors, getFieldProps, setFieldValue, errorId, validateAll, setServerErrors } = useValidatedForm(
    toFormValues(product),
    validateProductForm,
  )
  const { run, isPending } = useAdminMutation()
  const [formError, setFormError] = useState(null)

  const categoryNames = categories.map((category) => category.name)
  const [categoryMode, setCategoryMode] = useState(() =>
    categoryNames.length && (!product || categoryNames.includes(product.category)) ? 'existing' : 'new',
  )
  const previewUrls = parseImageList(useDebounce(values.images, 500)).filter((url) => /^https?:\/\/\S+$/i.test(url))
  const descriptionLength = values.description.trim().length

  const handleCategorySelect = (event) => {
    if (event.target.value === NEW_CATEGORY) {
      setCategoryMode('new')
      setFieldValue('category', '')
      return
    }
    setFieldValue('category', event.target.value)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    const clientErrors = validateAll()
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(formRef.current, clientErrors)
      return
    }

    const payload = toPayload(values, product)
    const { ok, data, error } = await run('save', () =>
      isEdit ? api.put(`/products/${product._id}`, payload) : api.post('/products', payload),
    )
    if (ok) {
      toast.success(isEdit ? `Saved changes to "${data.product.name}"` : `Created "${data.product.name}"`)
      onSaved(data.product)
      return
    }

    const shown = setServerErrors(error.fieldErrors)
    if (Object.keys(shown).length) focusFirstInvalid(formRef.current, shown)
    // Anything the form can't pin to a field (conflicts, network, unknown fields) goes in the banner.
    if (Object.keys(shown).length < Object.keys(error.fieldErrors).length || !Object.keys(shown).length) {
      setFormError(error.message)
    }
  }

  // Label/error wiring for FormField; the control gets the matching id from getFieldProps.
  const field = (name) => ({ htmlFor: getFieldProps(name).id, error: errors[name], errorId: errorId(name) })

  return (
    <AdminDialog
      open
      title={isEdit ? 'Edit product' : 'Add product'}
      description={isEdit ? product.name : 'New products appear in the store as soon as they are saved.'}
      onClose={onClose}
      busy={isPending}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </>
      }
    >
      <form id={formId} ref={formRef} noValidate onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        {formError && <ErrorMessage title="Couldn't save the product" message={formError} className="sm:col-span-2" />}

        <FormField label="Name" {...field('name')} className="sm:col-span-2">
          <input className="input" maxLength={LIMITS.productName.max} autoComplete="off" {...getFieldProps('name')} />
        </FormField>

        <FormField
          label="Description"
          {...field('description')}
          className="sm:col-span-2"
          aside={
            <span className="text-xs text-stone-500 tabular-nums">
              {descriptionLength}/{LIMITS.description.max}
            </span>
          }
        >
          <textarea className="input min-h-28 resize-y" rows={4} {...getFieldProps('description')} />
        </FormField>

        <FormField label="Price (₹)" {...field('price')}>
          <input className="input" type="number" inputMode="decimal" min="0" step="any" {...getFieldProps('price')} />
        </FormField>

        <FormField label="MRP (₹)" optional {...field('mrp')}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="Shown struck through"
            {...getFieldProps('mrp')}
          />
        </FormField>

        <FormField
          label="Category"
          {...field('category')}
          aside={
            categoryNames.length > 0 &&
            categoryMode === 'new' && (
              <button
                type="button"
                className="link text-xs"
                onClick={() => {
                  setCategoryMode('existing')
                  setFieldValue('category', '')
                }}
              >
                Choose existing
              </button>
            )
          }
        >
          {categoryMode === 'existing' ? (
            <select className="input" {...getFieldProps('category')} onChange={handleCategorySelect}>
              <option value="">Select a category…</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {formatCategory(name)}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          ) : (
            <input
              className="input"
              placeholder="e.g. smart-watches"
              autoComplete="off"
              autoFocus={categoryNames.length > 0}
              maxLength={MAX_CATEGORY_LENGTH}
              {...getFieldProps('category')}
            />
          )}
        </FormField>

        <FormField label="Brand" optional {...field('brand')}>
          <input className="input" maxLength={60} autoComplete="off" {...getFieldProps('brand')} />
        </FormField>

        <FormField label="Stock" {...field('stock')}>
          <input className="input" type="number" inputMode="numeric" min="0" step="1" {...getFieldProps('stock')} />
        </FormField>

        <FormField label="Tags" optional {...field('tags')}>
          <input
            className="input"
            placeholder="wireless, bluetooth"
            autoComplete="off"
            {...getFieldProps('tags', { describedBy: `${formId}-tags-hint` })}
          />
          <p id={`${formId}-tags-hint`} className="mt-1 text-xs text-stone-500">
            Comma separated, used by search.
          </p>
        </FormField>

        <FormField label="Image URLs" optional {...field('images')} className="sm:col-span-2">
          <textarea
            className="input min-h-24 resize-y font-mono text-xs"
            rows={3}
            spellCheck={false}
            placeholder={'https://cdn.example.com/front.jpg\nhttps://cdn.example.com/side.jpg'}
            {...getFieldProps('images', { describedBy: `${formId}-images-hint` })}
          />
          <p id={`${formId}-images-hint`} className="mt-1 text-xs text-stone-500">
            One http(s) URL per line, up to {MAX_IMAGES}. The first image is the thumbnail.
          </p>
          {previewUrls.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Image previews">
              {previewUrls.slice(0, MAX_IMAGES).map((url, index) => (
                <li key={`${url}-${index}`} className="relative">
                  <AdminThumbnail src={url} alt={`Image ${index + 1}`} className="size-16" />
                  {index === 0 && (
                    <span className="badge absolute -top-1.5 -left-1.5 bg-brand-700 px-1.5 text-[10px] text-white">
                      Main
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FormField>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-3 sm:col-span-2">
          <input
            type="checkbox"
            name="isFeatured"
            className="checkbox mt-0.5"
            checked={values.isFeatured}
            onChange={(event) => setFieldValue('isFeatured', event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-stone-800">Featured product</span>
            <span className="block text-xs text-stone-500">Highlighted on the storefront home page.</span>
          </span>
        </label>
      </form>
    </AdminDialog>
  )
}
