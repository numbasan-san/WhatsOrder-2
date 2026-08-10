export interface ProductItem {
  product: string;
  quantity: number;
  subtotal: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string | null;
  cedula: string | null;
}

export interface Delivery {
  address: string;
  city: string;
  zone: string;
  instructions: string;
}

export interface Pedido {
  id: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    cedula: string | null;
  };
  delivery: {
    address: string;
    city: string;
    zone: string;
    instructions: string;
  };
  items: Array<{
    product: string;
    quantity: number;
    subtotal: number;
  }>;
  total: number;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason?: string | null;
  delivery_assigned_to: string | null;
  delivery_status: string | null;
  delivery_eta: string | null;
  source?: string;
  notes?: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'csr';
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile?: UserProfile;
}