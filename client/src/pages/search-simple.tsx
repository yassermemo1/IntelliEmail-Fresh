import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleSearch } from "@/hooks/useSimpleSearch";
import { format } from "date-fns";
import { Mail, CheckSquare, User, Calendar } from "lucide-react";

const SearchSimple = () => {
  const { query, setQuery, results, isLoading, error } = useSimpleSearch();

  const emails = results.filter(r => r.type === 'email');
  const tasks = results.filter(r => r.type === 'task');

  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Search</h2>
          <p className="text-gray-600">Search across your tasks and emails</p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search for tasks and emails..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-2xl"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="text-gray-600">Searching...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-8">
            <div className="text-red-600">{error}</div>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && query.length >= 2 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="text-sm text-gray-600">
              Found {results.length} results ({emails.length} emails, {tasks.length} tasks)
            </div>

            {/* Email Results */}
            {emails.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Emails ({emails.length})
                </h3>
                <div className="space-y-3">
                  {emails.map((email) => (
                    <Card key={email.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {email.subject}
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {email.sender}
                              </div>
                              {email.date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {format(new Date(email.date), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Task Results */}
            {tasks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Tasks ({tasks.length})
                </h3>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-gray-600 text-sm mb-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              {task.priority && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  task.priority === 'high' 
                                    ? 'bg-red-100 text-red-800'
                                    : task.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {task.priority}
                                </span>
                              )}
                              {task.status && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                  {task.status}
                                </span>
                              )}
                              {task.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {results.length === 0 && query.length >= 2 && (
              <div className="text-center py-8">
                <div className="text-gray-600">No results found for "{query}"</div>
              </div>
            )}
          </div>
        )}

        {/* No Query */}
        {query.length < 2 && (
          <div className="text-center py-8">
            <div className="text-gray-600">Start typing to search...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchSimple;