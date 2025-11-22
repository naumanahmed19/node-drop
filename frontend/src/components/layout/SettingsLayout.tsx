import { cn } from '@/lib/utils'
import { Webhook } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface SettingsLayoutProps {
  children: React.ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const navItems = [
    {
      title: 'Webhook Requests',
      path: '/webhook-requests',
      icon: Webhook,
      description: 'View webhook request logs',
    },
  ]

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Settings</h2>
            <p className="text-sm text-gray-500">Manage your account and preferences</p>
          </div>
          
          <nav className="px-3 pb-6">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-start gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', active ? 'text-primary-600' : 'text-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.title}</div>
                        <div className={cn('text-xs mt-0.5', active ? 'text-primary-600' : 'text-gray-500')}>
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}
