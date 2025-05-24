import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, FilterIcon, X } from "lucide-react";
import { format } from "date-fns";
import TaskCard from "@/components/TaskCard";
import EmailPreview from "@/components/EmailPreview";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import { useSimpleSearch } from "@/hooks/useSimpleSearch";
import { useUpdateTask } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@shared/schema";

interface SearchFilter {
  type: string;
  value: string;
  label: string;
}

const Search: React.FC = () => {
  const { toast } = useToast();
  // Remove duplicate query state - using from useSimpleSearch hook
  const [searchType, setSearchType] = useState<'all' | 'tasks' | 'emails'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Advanced search filters
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [ccFilter, setCcFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<string>("any");
  const [isRead, setIsRead] = useState<string>("");
  const [category, setCategory] = useState<string>("any");
  
  // Active filters for display
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
  
  // Flag to track if any filters are active
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  
  // Construct the combined search string with filters
  const [effectiveSearchQuery, setEffectiveSearchQuery] = useState("");
  
  // Update effective search query when filters change
  useEffect(() => {
    // Start with the user's search query if any
    let query = searchQuery || "";
    
    // Check if any filters are active
    const filtersActive = !!(
      fromFilter || 
      toFilter || 
      ccFilter || 
      subjectFilter || 
      hasAttachment || 
      dateFrom || 
      dateTo || 
      (priority && priority !== 'any') || 
      isRead === 'read' || 
      isRead === 'unread' || 
      (category && category !== 'any')
    );
    
    // Update the hasActiveFilters state
    setHasActiveFilters(filtersActive);
    
    // If we have active filters but no search query, add a special indicator
    // so the search backend knows we want to search with just filters
    if (filtersActive && !searchQuery) {
      query = "*"; // Special wildcard character to match all items
    }
    
    // Append filters to the query
    if (fromFilter) query += ` from:"${fromFilter}"`;
    if (toFilter) query += ` to:"${toFilter}"`;
    if (ccFilter) query += ` cc:"${ccFilter}"`;
    if (subjectFilter) query += ` subject:"${subjectFilter}"`;
    if (hasAttachment) query += ` has:attachment`;
    if (dateFrom) query += ` after:${format(dateFrom, 'yyyy-MM-dd')}`;
    if (dateTo) query += ` before:${format(dateTo, 'yyyy-MM-dd')}`;
    if (priority && priority !== 'any') query += ` priority:${priority}`;
    if (isRead === 'read') query += ` is:read`;
    if (isRead === 'unread') query += ` is:unread`;
    if (category && category !== 'any') query += ` category:${category}`;
    
    setEffectiveSearchQuery(query);
    
    // Update active filters for display
    const filters: SearchFilter[] = [];
    if (fromFilter) filters.push({ type: 'from', value: fromFilter, label: `From: ${fromFilter}` });
    if (toFilter) filters.push({ type: 'to', value: toFilter, label: `To: ${toFilter}` });
    if (ccFilter) filters.push({ type: 'cc', value: ccFilter, label: `CC: ${ccFilter}` });
    if (subjectFilter) filters.push({ type: 'subject', value: subjectFilter, label: `Subject: ${subjectFilter}` });
    if (hasAttachment) filters.push({ type: 'attachment', value: 'true', label: 'Has Attachments' });
    if (dateFrom) filters.push({ type: 'after', value: format(dateFrom, 'yyyy-MM-dd'), label: `After: ${format(dateFrom, 'MMM d, yyyy')}` });
    if (dateTo) filters.push({ type: 'before', value: format(dateTo, 'yyyy-MM-dd'), label: `Before: ${format(dateTo, 'MMM d, yyyy')}` });
    if (priority && priority !== 'any') filters.push({ type: 'priority', value: priority, label: `Priority: ${priority}` });
    if (isRead === 'read') filters.push({ type: 'read', value: isRead, label: `Status: Read` });
    if (isRead === 'unread') filters.push({ type: 'read', value: isRead, label: `Status: Unread` });
    if (category && category !== 'any') filters.push({ type: 'category', value: category, label: `Category: ${category}` });
    
    setActiveFilters(filters);
  }, [
    searchQuery, 
    fromFilter, 
    toFilter, 
    ccFilter, 
    subjectFilter, 
    hasAttachment, 
    dateFrom, 
    dateTo, 
    priority,
    isRead,
    category
  ]);
  
  // Use the simple search that works with our direct database endpoints
  const { query, setQuery, results, isLoading, error } = useSimpleSearch();
  
  // Separate results by type
  const emails = results.filter(r => r.type === 'email');
  const tasks = results.filter(r => r.type === 'task');
  const totalResults = results.length;
  
  // Construct search results format to match expected structure
  const searchResults = {
    emails: emails || [],
    tasks: tasks || []
  };
  
  // Remove a specific filter
  const removeFilter = (filterType: string, filterValue: string) => {
    switch (filterType) {
      case 'from': setFromFilter(""); break;
      case 'to': setToFilter(""); break;
      case 'cc': setCcFilter(""); break;
      case 'subject': setSubjectFilter(""); break;
      case 'attachment': setHasAttachment(false); break;
      case 'after': setDateFrom(undefined); break;
      case 'before': setDateTo(undefined); break;
      case 'priority': setPriority(""); break;
      case 'read': setIsRead(""); break;
      case 'category': setCategory(""); break;
    }
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setFromFilter("");
    setToFilter("");
    setCcFilter("");
    setSubjectFilter("");
    setHasAttachment(false);
    setDateFrom(undefined);
    setDateTo(undefined);
    setPriority("");
    setIsRead("");
    setCategory("");
  };
  
  // Mutations
  const updateTaskMutation = useUpdateTask();
  
  // Find the selected task for the detail panel
  const selectedTask = searchResults?.tasks?.find((task: Task) => task.id === selectedTaskId);
  
  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Force a refresh of the search results
    setIsSearching(true);
    
    // Update the URL with search parameters for better sharing/bookmarking
    const searchParams = new URLSearchParams();
    if (searchQuery) searchParams.append("q", searchQuery);
    if (fromFilter) searchParams.append("from", fromFilter);
    if (toFilter) searchParams.append("to", toFilter);
    if (ccFilter) searchParams.append("cc", ccFilter);
    if (subjectFilter) searchParams.append("subject", subjectFilter);
    if (hasAttachment) searchParams.append("attachment", "true");
    if (dateFrom) searchParams.append("after", format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) searchParams.append("before", format(dateTo, 'yyyy-MM-dd'));
    if (priority && priority !== 'any') searchParams.append("priority", priority);
    if (isRead !== '') searchParams.append("read", isRead);
    if (category && category !== 'any') searchParams.append("category", category);
    
    // Update the URL without full page reload
    window.history.pushState({}, '', `?${searchParams.toString()}`);
    
    // Run the search (this will trigger the hook to run again)
    const tempQuery = effectiveSearchQuery + " "; // Add a space to force the hook to rerun
    setEffectiveSearchQuery(tempQuery);
    
    // Show a toast to confirm the search is running
    toast({
      title: "Searching...",
      description: hasActiveFilters ? 
        "Searching with filters applied" : 
        "Searching for " + searchQuery,
    });
    
    // Reset the searching state after a short delay
    setTimeout(() => {
      setIsSearching(false);
    }, 500);
  };
  
  // Task operations
  const handleToggleTaskComplete = (id: number) => {
    const task = searchResults?.tasks?.find((t: Task) => t.id === id);
    if (task) {
      updateTaskMutation.mutate({
        id,
        data: { isCompleted: !task.isCompleted }
      }, {
        onSuccess: () => {
          toast({
            title: "Task updated",
            description: `Task marked as ${!task.isCompleted ? 'completed' : 'incomplete'}.`,
          });
          // The search results will update automatically when we navigate back to the search page
        }
      });
    }
  };
  
  const handleEditTask = (id: number) => {
    setSelectedTaskId(id);
  };
  
  const handleOpenTaskMenu = (id: number) => {
    // This would normally open a dropdown menu
    console.log("Open menu for task", id);
  };
  
  // Email operations
  const handleViewEmail = (id: number) => {
    // Navigate to the email detail view
    window.location.href = `/emails/${id}`;
  };
  
  const handleOpenEmailMenu = (id: number) => {
    // This would normally open a dropdown menu
    console.log("Open menu for email", id);
  };
  
  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Semantic Search</h2>
          <p className="mt-1 text-sm text-gray-500">Search across your tasks and emails using natural language</p>
        </div>
        
        {/* Search form */}
        <form onSubmit={handleSearch} className="mt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Enter your search query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="shrink-0"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-4 w-4 mr-2" />
              Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </Button>
            <Button 
              type="submit" 
              className="shrink-0" 
              disabled={isLoading || isSearching}
            >
              {isLoading || isSearching ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Searching...
                </>
              ) : (
                <>
                  <span className="material-icons mr-2">search</span>
                  Search
                </>
              )}
            </Button>
          </div>
          
          {/* Display active filters */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="p-1.5">
                  {filter.label}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter(filter.type, filter.value)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              
              {activeFilters.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
          
          {/* Advanced filters UI */}
          {showFilters && (
            <div className="bg-white shadow-md rounded-md p-4 mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* From filter */}
              <div className="space-y-2">
                <Label htmlFor="from-filter">From</Label>
                <Input
                  id="from-filter"
                  placeholder="Sender email or name"
                  value={fromFilter}
                  onChange={(e) => setFromFilter(e.target.value)}
                />
              </div>
              
              {/* To filter */}
              <div className="space-y-2">
                <Label htmlFor="to-filter">To</Label>
                <Input
                  id="to-filter"
                  placeholder="Recipient email or name"
                  value={toFilter}
                  onChange={(e) => setToFilter(e.target.value)}
                />
              </div>
              
              {/* CC filter */}
              <div className="space-y-2">
                <Label htmlFor="cc-filter">CC</Label>
                <Input
                  id="cc-filter"
                  placeholder="CC email or name"
                  value={ccFilter}
                  onChange={(e) => setCcFilter(e.target.value)}
                />
              </div>
              
              {/* Subject filter */}
              <div className="space-y-2">
                <Label htmlFor="subject-filter">Subject</Label>
                <Input
                  id="subject-filter"
                  placeholder="Email subject"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                />
              </div>
              
              {/* Date range filters */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "MMM dd, yyyy") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              {/* Has attachment filter */}
              <div className="space-y-2">
                <Label className="block mb-2">Attachments</Label>
                <div className="flex items-center">
                  <Checkbox 
                    id="has-attachment" 
                    checked={hasAttachment}
                    onCheckedChange={(checked) => setHasAttachment(checked === true)}
                  />
                  <label
                    htmlFor="has-attachment"
                    className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Has attachments
                  </label>
                </div>
              </div>
              
              {/* Priority filter */}
              <div className="space-y-2">
                <Label htmlFor="priority-filter">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Read/Unread filter */}
              <div className="space-y-2">
                <Label htmlFor="read-status">Read Status</Label>
                <Select value={isRead} onValueChange={setIsRead}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any status</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Category filter */}
              <div className="space-y-2">
                <Label htmlFor="category-filter">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any category</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="updates">Updates</SelectItem>
                    <SelectItem value="promotions">Promotions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </form>
        
        {/* Search results */}
        <div className="mt-6">
          <Tabs defaultValue="all" onValueChange={(value) => setSearchType(value as 'all' | 'tasks' | 'emails')}>
            <TabsList>
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              {!searchQuery ? (
                <div className="text-center py-8">
                  <span className="material-icons text-4xl text-gray-300">search</span>
                  <p className="mt-2 text-gray-500">Enter a search query to find tasks and emails</p>
                </div>
              ) : isLoading ? (
                <div className="text-center py-8">Loading results...</div>
              ) : (
                <>
                  {/* Tasks section */}
                  <div className="bg-white shadow rounded-lg mb-6">
                    <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Tasks ({searchResults?.tasks?.length || 0})
                      </h3>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                      {!searchResults?.tasks?.length ? (
                        <div className="p-4 text-center text-gray-500">No tasks match your search</div>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {searchResults.tasks.map((task: Task) => (
                            <TaskCard
                              key={task.id}
                              id={task.id}
                              title={task.title}
                              description={task.description || ""}
                              priority={task.priority as "high" | "medium" | "low"}
                              dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
                              createdAt={new Date(task.createdAt)}
                              isCompleted={task.isCompleted}
                              onToggleComplete={handleToggleTaskComplete}
                              onEdit={handleEditTask}
                              onOpenMenu={handleOpenTaskMenu}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  
                  {/* Emails section */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Emails ({searchResults?.emails?.length || 0})
                      </h3>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                      {!searchResults?.emails?.length ? (
                        <div className="p-4 text-center text-gray-500">No emails match your search</div>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {searchResults.emails.map((email: any) => (
                            <EmailPreview
                              key={email.id}
                              id={email.id}
                              subject={email.subject}
                              sender={email.sender}
                              timestamp={new Date(email.timestamp)}
                              body={email.body}
                              tasksExtracted={1} // This would normally come from the backend
                              onView={handleViewEmail}
                              onOpenMenu={handleOpenEmailMenu}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="tasks" className="mt-4">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Tasks ({searchResults?.tasks?.length || 0})
                  </h3>
                </div>
                
                <div className="overflow-y-auto max-h-[calc(100vh-300px)] custom-scrollbar">
                  {!searchQuery ? (
                    <div className="text-center py-8">
                      <span className="material-icons text-4xl text-gray-300">search</span>
                      <p className="mt-2 text-gray-500">Enter a search query to find tasks</p>
                    </div>
                  ) : isLoading ? (
                    <div className="text-center py-8">Loading results...</div>
                  ) : !searchResults?.tasks?.length ? (
                    <div className="p-4 text-center text-gray-500">No tasks match your search</div>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {searchResults.tasks.map((task: Task) => (
                        <TaskCard
                          key={task.id}
                          id={task.id}
                          title={task.title}
                          description={task.description || ""}
                          priority={task.priority as "high" | "medium" | "low"}
                          dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
                          createdAt={new Date(task.createdAt)}
                          isCompleted={task.isCompleted}
                          onToggleComplete={handleToggleTaskComplete}
                          onEdit={handleEditTask}
                          onOpenMenu={handleOpenTaskMenu}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="emails" className="mt-4">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Emails ({searchResults?.emails?.length || 0})
                  </h3>
                </div>
                
                <div className="overflow-y-auto max-h-[calc(100vh-300px)] custom-scrollbar">
                  {!searchQuery ? (
                    <div className="text-center py-8">
                      <span className="material-icons text-4xl text-gray-300">search</span>
                      <p className="mt-2 text-gray-500">Enter a search query to find emails</p>
                    </div>
                  ) : isLoading ? (
                    <div className="text-center py-8">Loading results...</div>
                  ) : !searchResults?.emails?.length ? (
                    <div className="p-4 text-center text-gray-500">No emails match your search</div>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {searchResults.emails.map((email: any) => (
                        <EmailPreview
                          key={email.id}
                          id={email.id}
                          subject={email.subject}
                          sender={email.sender}
                          timestamp={new Date(email.timestamp)}
                          body={email.body}
                          tasksExtracted={1} // This would normally come from the backend
                          onView={handleViewEmail}
                          onOpenMenu={handleOpenEmailMenu}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
};

export default Search;
