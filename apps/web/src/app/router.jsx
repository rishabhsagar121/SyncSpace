import { createBrowserRouter } from 'react-router-dom';
import Landing from '@/pages/Landing/Landing';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
]);