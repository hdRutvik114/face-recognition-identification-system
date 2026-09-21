import axios from 'axios'

// Single Axios instance reading the base URL from the environment.
// No other file should hardcode the backend URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

/**
 * Enroll a person with up to 3 face images.
 * @param {string} name - Person's name
 * @param {File[]} imageFiles - Array of File objects (1–3 images)
 * @returns {Promise<object>} Backend enrollment response
 */
export async function enrollPerson(name, imageFiles) {
  const form = new FormData()
  form.append('name', name)
  imageFiles.forEach((file) => form.append('images', file))
  const { data } = await api.post('/enroll', form)
  return data
}

/**
 * Identify a person from a single face image.
 * @param {File} imageFile - Single image file
 * @returns {Promise<object>} Backend identification response
 */
export async function identifyPerson(imageFile) {
  const form = new FormData()
  form.append('image', imageFile)
  const { data } = await api.post('/identify', form)
  return data
}
