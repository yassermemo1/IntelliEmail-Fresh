import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Emails from "@/pages/emails";
import CleanedEmails from "@/pages/cleaned-emails";
import RagEmails from "@/pages/rag-emails";
import EmailDetail from "@/pages/email-detail";
import Search from "@/pages/search";
import SearchSimple from "@/pages/search-simple";
import HitlReview from "@/pages/hitl-review";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import EmailAI from "@/pages/email-ai";
import AiSettings from "@/pages/ai-settings";
import Accounts from "@/pages/accounts";
import TaskAnalysis from "@/pages/task-analysis";
import Analytics from "@/pages/analytics";
import Admin from "@/pages/admin";
import OllamaSettings from "@/pages/ollama-settings";
import FixApiKey from "@/pages/fix-api-key";
import OpenAiTest from "@/pages/openai-test";
import TaskExtractionTestPage from "@/pages/TaskExtractionTestPage";
import EnhancedBatchProcessingPage from "@/pages/EnhancedBatchProcessingPage";
import Layout from "@/components/Layout";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/emails" component={Emails} />
        <Route path="/cleaned-emails" component={CleanedEmails} />
        <Route path="/rag-emails" component={RagEmails} />
        <Route path="/emails/:id" component={EmailDetail} />
        <Route path="/emails/:id/related" component={EmailDetail} />
        <Route path="/search" component={SearchSimple} />
        <Route path="/hitl-review" component={HitlReview} />
        <Route path="/email-ai" component={EmailAI} />
        <Route path="/ai-settings" component={AiSettings} />
        <Route path="/settings" component={Settings} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/task-analysis" component={TaskAnalysis} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/admin" component={Admin} />
        <Route path="/fix-api-key" component={FixApiKey} />
        <Route path="/openai-test" component={OpenAiTest} />
        <Route path="/task-extraction-test" component={TaskExtractionTestPage} />
        <Route path="/enhanced-batch" component={EnhancedBatchProcessingPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
