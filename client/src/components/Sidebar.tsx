import React from "react";
import { Link, useLocation } from "wouter";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const [location] = useLocation();
  const { data: emailAccounts, isLoading, refetch: refetchAccounts } = useEmailAccounts();
  
  // Refetch accounts on component mount to ensure we have the latest data
  React.useEffect(() => {
    refetchAccounts();
  }, [refetchAccounts]);
  
  const isActive = (path: string) => {
    return location === path || (path !== "/" && location.startsWith(path)) ? "active" : "";
  };
  
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-16 md:w-64'} bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 fixed md:relative z-50 h-full`}>
      <div className="flex flex-col h-full">
        {/* User profile area */}
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary text-white flex items-center justify-center">
              <span className="text-sm md:text-base font-semibold">JD</span>
            </div>
            <div className="ml-3 hidden md:block">
              <div className="font-medium text-sm text-gray-900">John Doe</div>
              <div className="text-xs text-gray-500">john.doe@example.com</div>
            </div>
          </div>
        </div>
        
        {/* Main Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 pt-2 pb-2 md:pt-4 md:pb-4">
            <div className="px-2 md:px-4">
              <div className="space-y-0.5 md:space-y-1">
                <Link href="/" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Dashboard">
                  <span className={`material-icons ${isActive("/") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>dashboard</span>
                  <span className="hidden md:inline">Dashboard</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Dashboard</span>
                </Link>
                <Link href="/tasks" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/tasks") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Tasks">
                  <span className={`material-icons ${isActive("/tasks") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>task_alt</span>
                  <span className="hidden md:inline">Tasks</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Tasks</span>
                </Link>
                <Link href="/emails" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/emails") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Emails">
                  <span className={`material-icons ${isActive("/emails") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>email</span>
                  <span className="hidden md:inline">Emails</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Emails</span>
                </Link>
                <Link href="/search" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/search") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Semantic Search">
                  <span className={`material-icons ${isActive("/search") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>find_in_page</span>
                  <span className="hidden md:inline">Semantic Search</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Search</span>
                </Link>
                <Link href="/hitl-review" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/hitl-review") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="HITL Review">
                  <span className={`material-icons ${isActive("/hitl-review") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>reviews</span>
                  <span className="hidden md:inline">HITL Review</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Review</span>
                </Link>
                <Link href="/email-ai" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/email-ai") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Ask AI">
                  <span className={`material-icons ${isActive("/email-ai") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>psychology_alt</span>
                  <span className="hidden md:inline">Ask AI</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Ask AI</span>
                </Link>
                <Link href="/ai-settings" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/ai-settings") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="AI Models">
                  <span className={`material-icons ${isActive("/ai-settings") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>model_training</span>
                  <span className="hidden md:inline">AI Models</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Models</span>
                </Link>
                <Link href="/task-extraction-test" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/task-extraction-test") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Task Extraction">
                  <span className={`material-icons ${isActive("/task-extraction-test") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>auto_awesome</span>
                  <span className="hidden md:inline">Task Extraction</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Extract</span>
                </Link>
                <Link href="/enhanced-batch" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/enhanced-batch") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Enhanced Batch">
                  <span className={`material-icons ${isActive("/enhanced-batch") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>batch_prediction</span>
                  <span className="hidden md:inline">Enhanced Batch</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Batch</span>
                </Link>
                <Link href="/task-analysis" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/task-analysis") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Task Analysis">
                  <span className={`material-icons ${isActive("/task-analysis") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>analytics</span>
                  <span className="hidden md:inline">Task Analysis</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Analysis</span>
                </Link>
                <Link href="/analytics" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/analytics") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Email Analytics">
                  <span className={`material-icons ${isActive("/analytics") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>bar_chart</span>
                  <span className="hidden md:inline">Email Analytics</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Analytics</span>
                </Link>
                <Link href="/accounts" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/accounts") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Accounts">
                  <span className={`material-icons ${isActive("/accounts") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>account_box</span>
                  <span className="hidden md:inline">Accounts</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Accounts</span>
                </Link>
                <Link href="/admin" className={`sidebar-item group relative flex items-center py-2 px-3 rounded-md text-sm font-medium ${isActive("/admin") ? "active text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"}`} title="Admin">
                  <span className={`material-icons ${isActive("/admin") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>admin_panel_settings</span>
                  <span className="hidden md:inline">Admin</span>
                  <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Admin</span>
                </Link>
              </div>
            </div>
          </nav>
          
          {/* Connected Accounts */}
          <div className="px-3 md:px-4 mb-4">
            <h3 className="hidden md:block px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Connected Accounts
            </h3>
            <div className="mt-2 space-y-1">
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading accounts...</div>
              ) : !emailAccounts || emailAccounts.length === 0 ? (
                <Link 
                  href="/accounts"
                  className="flex items-center py-2 px-3 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-primary"
                >
                  <span className="material-icons text-gray-500 mr-3 text-xl">add_circle</span>
                  <span className="hidden md:inline">Add first account</span>
                </Link>
              ) : (
                emailAccounts.map((account) => (
                  <div 
                    key={account.id}
                    className="sidebar-item flex items-center py-2 px-3 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <span className={`material-icons ${account.accountType === 'gmail' ? 'text-red-500' : 'text-blue-500'} mr-3 text-xl`}>
                      {account.accountType === 'gmail' ? 'mail' : 'inbox'}
                    </span>
                    <span className="hidden md:inline truncate max-w-[140px]">{account.emailAddress}</span>
                    <span className={`ml-auto w-2 h-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Settings */}
        <div className="border-t border-gray-200 p-4">
          <Link href="/settings" className={`group relative flex items-center text-sm font-medium ${isActive("/settings") ? "text-primary" : "text-gray-600 hover:text-primary"}`}>
            <span className={`material-icons ${isActive("/settings") ? "text-primary" : "text-gray-500"} mr-3 text-lg md:text-xl`}>settings</span>
            <span className="hidden md:inline">Settings</span>
            <span className="absolute left-16 z-50 bg-gray-800 text-white text-xs rounded px-2 py-1 md:hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;