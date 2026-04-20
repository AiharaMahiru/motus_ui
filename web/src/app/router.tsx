import { Suspense, lazy } from 'react'

import { Navigate, createBrowserRouter } from 'react-router-dom'

import { WorkbenchLoadingScreen } from '../shared/components/WorkbenchLoadingScreen'
import { AppShell } from './AppShell'

const ChatPage = lazy(() => import('../features/chat/pages/ChatPage').then((module) => ({ default: module.ChatPage })))
const WorkflowPage = lazy(() =>
  import('../features/workflows/pages/WorkflowPage').then((module) => ({ default: module.WorkflowPage })),
)
const routeFallback = <WorkbenchLoadingScreen />

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/chat" />,
      },
      {
        path: 'chat/:sessionId?',
        element: (
          <Suspense fallback={routeFallback}>
            <ChatPage />
          </Suspense>
        ),
      },
      {
        path: 'workflows/:runId?',
        element: (
          <Suspense fallback={routeFallback}>
            <WorkflowPage />
          </Suspense>
        ),
      },
    ],
  },
])
