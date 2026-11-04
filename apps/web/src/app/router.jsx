// apps/web/src/app/router.jsx
import { createBrowserRouter } from 'react-router-dom';
import Landing from '@/pages/Landing/Landing';
import Login from '@/pages/Login/Login';
import Register from '@/pages/Register/Register';
import Dashboard from '@/pages/Dashboard/DashBoard';
import Room from '@/pages/Room/Room';
import Friends from '@/pages/Friends/Friends';
import Calendar from '@/pages/Calendar/Calendar';
import Settings from '@/pages/Settings/Settings';
import AppLayout from '@/layouts/AppLayout';
import ProtectedRoute from '@/app/providers/ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'rooms', element: <Dashboard /> },
          { path: 'rooms/:roomId', element: <Room /> },
          { path: 'friends', element: <Friends /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);