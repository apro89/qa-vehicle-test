export const ApiRoutes = {
  orders: '/orders',
  orderById: (id: string) => `/orders/${encodeURIComponent(id)}`,
} as const;
