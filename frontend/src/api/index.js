import api from './axios'

export const auth = {
  login:  (data)    => api.post('/auth/login', data),
  logout: ()        => api.post('/auth/logout'),
  me:     ()        => api.get('/auth/me'),
}

export const users = {
  list:   ()        => api.get('/users'),
  get:    (id)      => api.get(`/users/${id}`),
  create: (data)    => api.post('/users', data),
  update: (id, data)=> api.put(`/users/${id}`, data),
  remove: (id)      => api.delete(`/users/${id}`),
}

export const materials = {
  list:   ()        => api.get('/materials'),
  get:    (id)      => api.get(`/materials/${id}`),
  create: (data)    => api.post('/materials', data),
  update: (id, data)=> api.put(`/materials/${id}`, data),
  remove: (id)      => api.delete(`/materials/${id}`),
}

export const locations = {
  list:   (params)  => api.get('/locations', { params }),
  get:    (id)      => api.get(`/locations/${id}`),
  create: (data)    => api.post('/locations', data),
  update: (id, data)=> api.put(`/locations/${id}`, data),
  remove: (id)      => api.delete(`/locations/${id}`),
}

export const machines = {
  list:   ()        => api.get('/machines'),
  get:    (id)      => api.get(`/machines/${id}`),
  create: (data)    => api.post('/machines', data),
  update: (id, data)=> api.put(`/machines/${id}`, data),
  remove: (id)      => api.delete(`/machines/${id}`),
}

export const inventory = {
  list:          ()          => api.get('/inventory'),
  byLocation:    (id)        => api.get(`/inventory/location/${id}`),
  adjust:        (data)      => api.put('/inventory/adjust', data),
}

export const tasks = {
  list:     (params)         => api.get('/tasks', { params }),
  get:      (id)             => api.get(`/tasks/${id}`),
  history:  (id)             => api.get(`/tasks/${id}/history`),
  create:   (data)           => api.post('/tasks', data),
  update:   (id, data)       => api.put(`/tasks/${id}`, data),
  remove:   (id)             => api.delete(`/tasks/${id}`),
  take:     (id)             => api.put(`/tasks/${id}/take`),
  assign:   (id, data)       => api.put(`/tasks/${id}/assign`, data),
  start:    (id)             => api.put(`/tasks/${id}/start`),
  pause:    (id, reason)     => api.put(`/tasks/${id}/pause`, { reason }),
  resume:   (id)             => api.put(`/tasks/${id}/resume`),
  complete: (id)             => api.put(`/tasks/${id}/complete`),
}

export const logs = {
  list: (params) => api.get('/logs', { params }),
}

export const simulation = {
  status: ()      => api.get('/simulation/status'),
  toggle: ()      => api.post('/simulation/toggle'),
  config: (data)  => api.put('/simulation/config', data),
}

export const activity = {
  list: (params) => api.get('/activity', { params }),
}

export const admin = {
  reset: () => api.post('/admin/reset'),
}
