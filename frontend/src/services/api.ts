import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send httpOnly cookies automatically on every request
  withCredentials: true,
});

// Attach language header and Bearer token (for non-httpOnly fallback during transition)
api.interceptors.request.use((config) => {
  // If the httpOnly cookie is set by the backend the browser sends it automatically.
  // Keep manual Authorization header as a fallback for non-cookie auth environments.
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = Cookies.get('NEXT_LOCALE') || 'ar';
  config.headers['Accept-Language'] = lang;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/register');
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        // POST /auth/refresh — the httpOnly refresh_token cookie is sent automatically
        // (withCredentials:true). Body token is kept for backward compat.
        const refreshToken = Cookies.get('refresh_token');
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          refreshToken ? { refresh_token: refreshToken } : {},
          { withCredentials: true },
        );
        // Backend sets new httpOnly cookies; also update js-cookie for fallback
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        if (data.data?.access_token) {
          Cookies.set('access_token', data.data.access_token, { expires: 1 / 96, secure: isSecure, sameSite: 'strict' });
          original.headers = { ...original.headers, Authorization: `Bearer ${data.data.access_token}` };
        }
        if (data.data?.refresh_token) {
          Cookies.set('refresh_token', data.data.refresh_token, { expires: 7, secure: isSecure, sameSite: 'strict' });
        }
        return api(original);
      } catch {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
      }
    }
    return Promise.reject(err);
  },
);

// ─── AUTH ─────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  sendOtp: () => api.post('/auth/send-phone-otp'),
  verifyPhone: (otp: string) => api.post('/auth/verify-phone', { otp }),
  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }),
};

// ─── USERS ───────────────────────────────────────────────────
export const usersApi = {
  getMyProfile: () => api.get('/users/me/profile'),
  getProfile: (id: string) => api.get(`/users/${id}/profile`),
  updateProfile: (data: any) => api.patch('/users/me/profile', data),
  updateSkills: (skills: any[]) => api.patch('/users/me/skills', { skills }),
  addPortfolio: (data: any) => api.post('/users/me/portfolio', data),
  deletePortfolio: (itemId: string) => api.delete(`/users/me/portfolio/${itemId}`),
  getWallet: () => api.get('/users/me/wallet'),
  getCategories: () => api.get('/users/categories'),
  getSkills: () => api.get('/users/skills/list'),
};

// ─── GIGS ─────────────────────────────────────────────────────
export const gigsApi = {
  list: (params?: any) => api.get('/gigs', { params }),
  get: (id: string) => api.get(`/gigs/${id}`),
  create: (data: any) => api.post('/gigs', data),
  update: (id: string, data: any) => api.patch(`/gigs/${id}`, data),
  delete: (id: string) => api.delete(`/gigs/${id}`),
  myGigs:       ()                 => api.get('/gigs/my'),
  byFreelancer: (userId: string)   => api.get(`/gigs/freelancer/${userId}`),
};

// ─── PROJECTS ─────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: any) => api.get('/projects', { params }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  close: (id: string) => api.delete(`/projects/${id}/close`),
  myProjects: () => api.get('/projects/my'),
};

// ─── PROPOSALS ───────────────────────────────────────────────
export const proposalsApi = {
  submit: (data: any) => api.post('/proposals', data),
  getProjectProposals: (projectId: string) => api.get(`/proposals/project/${projectId}`),
  myProposals: () => api.get('/proposals/my'),
  accept: (id: string) => api.patch(`/proposals/${id}/accept`),
  reject: (id: string, reason?: string) => api.patch(`/proposals/${id}/reject`, { reason }),
  withdraw: (id: string) => api.patch(`/proposals/${id}/withdraw`),
};

// ─── CONTRACTS ───────────────────────────────────────────────
export const contractsApi = {
  list:         ()                         => api.get('/contracts/my'),
  myContracts:  ()                         => api.get('/contracts/my'),
  get:          (id: string)               => api.get(`/contracts/${id}`),
  addMilestone: (id: string, data: any)    => api.post(`/contracts/${id}/milestones`, data),
  complete:     (id: string)               => api.patch(`/contracts/${id}/complete`),
};

// ─── MILESTONES ──────────────────────────────────────────────
export const milestonesApi = {
  start: (id: string) => api.patch(`/milestones/${id}/start`),
  submit: (id: string, data: any) => api.post(`/milestones/${id}/submit`, data),
  approve: (id: string) => api.patch(`/milestones/${id}/approve`),
  revision: (id: string, note: string) => api.patch(`/milestones/${id}/revision`, { note }),
};

// ─── ORDERS ──────────────────────────────────────────────────
export const ordersApi = {
  create:   (data: any) => api.post('/orders', data),
  list:     ()          => api.get('/orders/my'),
  myOrders: ()          => api.get('/orders/my'),
  get:      (id: string) => api.get(`/orders/${id}`),
  deliver: (id: string, data: any) => api.post(`/orders/${id}/deliver`, data),
  complete: (id: string) => api.patch(`/orders/${id}/complete`),
  revision: (id: string, note: string) => api.patch(`/orders/${id}/revision`, { note }),
  cancel: (id: string, reason: string) => api.patch(`/orders/${id}/cancel`, { reason }),
};

// ─── PAYMENTS ────────────────────────────────────────────────
export const paymentsApi = {
  checkoutOrder:      (order_id: string)     => api.post('/payments/checkout/order',     { order_id }),
  checkoutMilestone:  (milestone_id: string) => api.post('/payments/checkout/milestone', { milestone_id }),
  initiateLocal:      (dto: { order_id?: string; milestone_id?: string; payment_method: string; user_reference?: string; proof_image_url?: string }) =>
    api.post('/payments/initiate-local', dto),
  myPending:              ()              => api.get('/payments/my-pending'),
  myTransactions:         ()              => api.get('/payments/transactions'),
  getTransaction:         (id: string)   => api.get(`/payments/transactions/${id}`),
  adminRefund:            (orderId: string) => api.post(`/payments/refund/${orderId}`),
  adminPendingDeposits:   ()              => api.get('/payments/admin/pending-deposits'),
  adminConfirmDeposit:    (txId: string) => api.post(`/payments/admin/confirm/${txId}`),
};

// ─── CONTENT (public + admin) ─────────────────────────────────
export const contentApi = {
  getBanners:     (admin = false) => api.get('/content/banners', { params: admin ? { admin: '1' } : {} }),
  getFaq:         () => api.get('/content/faq'),
  getPage:        (key: string) => api.get(`/content/pages/${key}`),
  platformStats:  () => api.get('/content/platform-stats'),
  createBanner: (data: any) => api.post('/content/banners', data),
  updateBanner: (id: string, data: any) => api.patch(`/content/banners/${id}`, data),
  deleteBanner: (id: string) => api.delete(`/content/banners/${id}`),
  createFaq:  (data: any) => api.post('/content/faq', data),
  updateFaq:  (id: string, data: any) => api.patch(`/content/faq/${id}`, data),
  deleteFaq:  (id: string) => api.delete(`/content/faq/${id}`),
  updatePage: (key: string, content: string) => api.patch(`/content/pages/${key}`, { content }),
};

// ─── WALLETS ──────────────────────────────────────────────────
export const walletsApi = {
  me:               ()                          => api.get('/wallets/me'),
  myTransactions:   (limit = 50, offset = 0)    => api.get('/wallets/me/transactions', { params: { limit, offset } }),
  myEscrows:        ()                          => api.get('/wallets/me/escrows'),
  adminAll:         ()                          => api.get('/wallets/admin/all'),
  adminRevenue:     ()                          => api.get('/wallets/admin/revenue'),
};

// ─── CHAT ────────────────────────────────────────────────────
export const chatApi = {
  rooms: () => api.get('/chat/rooms'),
  messages: (roomId: string, page = 1) => api.get(`/chat/rooms/${roomId}/messages`, { params: { page } }),
  deleteMessage: (messageId: string) => api.delete(`/chat/messages/${messageId}`),
  // Interview phase: get or create a chat room linked to a proposal
  getOrCreateProposalRoom: (proposalId: string) => api.post(`/chat/rooms/proposal/${proposalId}`),
};

// ─── UPLOADS ─────────────────────────────────────────────────
export const uploadsApi = {
  single: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/uploads/single', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  multiple: (files: File[]) => {
    const fd = new FormData(); files.forEach((f) => fd.append('files', f));
    return api.post('/uploads/multiple', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── NOTIFICATIONS ───────────────────────────────────────────
export const notificationsApi = {
  list: (page = 1) => api.get('/notifications', { params: { page } }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ─── REVIEWS ─────────────────────────────────────────────────
export const reviewsApi = {
  create: (data: any) => api.post('/reviews/order', data),
  getFreelancerReviews: (id: string) => api.get(`/reviews/freelancer/${id}`),
};

// ─── WITHDRAWALS ─────────────────────────────────────────────
export const withdrawalsApi = {
  request: (data: any) => api.post('/withdrawals', data),
  my: () => api.get('/withdrawals/my'),
  pending: () => api.get('/withdrawals/admin/pending'),
  approve: (id: string, data: any) => api.patch(`/withdrawals/admin/${id}/approve`, data),
  reject: (id: string, reason: string) => api.patch(`/withdrawals/admin/${id}/reject`, { reason }),
};

// ─── SEARCH ──────────────────────────────────────────────────
export const searchApi = {
  freelancers: (params: any) => api.get('/search/freelancers', { params }),
  gigs: (params: any) => api.get('/search/gigs', { params }),
  projects: (params: any) => api.get('/search/projects', { params }),
};

// ─── ADMIN ───────────────────────────────────────────────────
export const adminApi = {
  stats:            ()                          => api.get('/admin/stats'),
  users:            (params?: any)              => api.get('/admin/users', { params }),
  updateUserStatus: (id: string, status: string) => api.patch(`/admin/users/${id}/status`, { status }),
  verifyIdentity:   (id: string, status: string, reason?: string) =>
    api.patch(`/admin/users/${id}/verify-identity`, { status, reason }),
  manualVerifyPhone: (id: string) => api.patch(`/admin/users/${id}/verify-phone`),
  gigs:             (params?: any)              => api.get('/admin/gigs', { params }),
  updateGigStatus:  (id: string, status: string) => api.patch(`/admin/gigs/${id}/status`, { status }),
  transactions:     (params?: any)              => api.get('/admin/transactions', { params }),
  settings:         ()                          => api.get('/admin/settings'),
  updateSetting:    (key: string, value: string) => api.patch(`/admin/settings/${key}`, { value }),
  // KYC
  kycQueue:         ()                          => api.get('/admin/kyc'),
  // Finance
  financeOverview:  ()                          => api.get('/admin/finance/overview'),
  // Disputes
  disputes:         (params?: any)              => api.get('/admin/disputes', { params }),
  getDispute:       (id: string)                => api.get(`/admin/disputes/${id}`),
  resolveDispute:   (id: string, data: any)     => api.patch(`/admin/disputes/${id}/resolve`, data),
  // Broadcast
  broadcast:        (data: any)                 => api.post('/admin/notifications/broadcast', data),
  // Projects
  projects:         (params?: any)              => api.get('/admin/projects', { params }),
  cancelProject:    (id: string)                => api.patch(`/admin/projects/${id}/cancel`),
  // Categories
  categories:       ()                          => api.get('/admin/categories'),
  createCategory:   (data: any)                 => api.post('/admin/categories', data),
  updateCategory:   (id: string, data: any)     => api.patch(`/admin/categories/${id}`, data),
  deleteCategory:   (id: string)                => api.delete(`/admin/categories/${id}`),
  // Skills
  skills:           ()                          => api.get('/admin/skills'),
  createSkill:      (data: any)                 => api.post('/admin/skills', data),
  updateSkill:      (id: string, data: any)     => api.patch(`/admin/skills/${id}`, data),
  deleteSkill:      (id: string)                => api.delete(`/admin/skills/${id}`),
  // Reports
  downloadReport:   (from: string, to: string, format: 'pdf' | 'excel') =>
    api.get(`/admin/reports/payments?from=${from}&to=${to}&format=${format}`, { responseType: 'blob' }),
  // CMS (delegates to /content/*)
  createBanner:     (data: any)                 => api.post('/content/banners', data),
  updateBanner:     (id: string, data: any)     => api.patch(`/content/banners/${id}`, data),
  deleteBanner:     (id: string)                => api.delete(`/content/banners/${id}`),
  createFaq:        (data: any)                 => api.post('/content/faq', data),
  updateFaq:        (id: string, data: any)     => api.patch(`/content/faq/${id}`, data),
  deleteFaq:        (id: string)                => api.delete(`/content/faq/${id}`),
  updatePage:       (key: string, content: string) => api.patch(`/content/pages/${key}`, { content }),
};

// ─── DOCUMENTS ───────────────────────────────────────────────
export const documentsApi = {
  paymentProof: (transactionId: string) =>
    api.get(`/documents/payment-proof/${transactionId}`, { responseType: 'blob' }),
};

// ─── TICKETS ─────────────────────────────────────────────────
export const ticketsApi = {
  create: (data: any) => api.post('/tickets', data),
  my: () => api.get('/tickets/my'),
  all: (params?: any) => api.get('/tickets/admin', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  reply: (id: string, data: any) => api.post(`/tickets/${id}/reply`, data),
  updateStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
};

// ─── DISPUTES ────────────────────────────────────────────────
export const disputesApi = {
  open: (data: any) => api.post('/disputes', data),
  my: () => api.get('/disputes/my'),
  get: (id: string) => api.get(`/disputes/${id}`),
  all: (params?: any) => api.get('/disputes', { params }),
  resolve: (id: string, data: any) => api.patch(`/disputes/${id}/resolve`, data),
};

export default api;
