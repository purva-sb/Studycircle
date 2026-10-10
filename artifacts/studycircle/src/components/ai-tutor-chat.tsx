import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export function AITutorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hi! I'm your AI Study Tutor. Ask me to explain a concept, quiz you, or help you plan your study schedule!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: me } = useGetMe();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Check usage limit
    const questionsAskedToday = parseInt(localStorage.getItem("sc_ai_count") || "0");
    if (me?.plan !== "pro" && questionsAskedToday >= 3) {
      toast.error("You've reached your free daily limit! Upgrade to Pro for unlimited AI tutoring.");
      setMessages(prev => [...prev, {
        id: Date.now().toString() + "sys",
        role: "system",
        content: "⚠️ You've reached the free limit of 3 questions per day. Upgrade to Pro for unlimited access."
      }]);
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Increment counter for free users
      if (me?.plan !== "pro") {
        localStorage.setItem("sc_ai_count", (questionsAskedToday + 1).toString());
      }

      // Mock API call since we don't have a real OpenAI key
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const responses = [
        "That's a great question! Based on your syllabus, you should focus on the underlying fundamentals first. Want me to break it down?",
        "Think of it this way: the concept is like a tree, and what you're asking about is just one branch. Let's trace it back to the trunk.",
        "Here's a quick way to remember that for your exam: use the mnemonic 'PEMDAS'. Does that help?",
        "I can certainly help you with that! The key formula you need is E = mc². Try plugging your numbers into that.",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: randomResponse
      }]);
    } catch (error) {
      toast.error("Failed to connect to the AI Tutor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-center ${isOpen ? 'hidden' : 'flex'}`}
      >
        <Bot className="w-6 h-6" />
        {me?.plan === "pro" && <Sparkles className="w-3 h-3 absolute top-3 right-3 text-yellow-300" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-50 w-[350px] sm:w-[400px] h-[500px] bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between px-4 text-white shrink-0">
              <div className="flex items-center gap-2 font-bold">
                <Bot className="w-5 h-5" />
                AI Study Tutor
                {me?.plan === "pro" && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] ml-1">PRO</span>}
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'system' ? (
                    <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg flex items-center gap-2 max-w-[90%]">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {msg.content}
                    </div>
                  ) : (
                    <div className={`max-w-[85%] flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-violet-500/20 text-violet-500'}`}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-br-sm' 
                          : 'bg-muted text-foreground rounded-bl-sm border border-border/50 shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-500 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-muted rounded-bl-sm border border-border/50 flex gap-1.5">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="relative">
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask a question..."
                  className="pr-12 rounded-full border-border/50 bg-background/50 focus-visible:ring-violet-500"
                />
                <Button 
                  size="icon" 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1 top-1 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {me?.plan !== "pro" && (
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  {3 - parseInt(localStorage.getItem("sc_ai_count") || "0")} free questions remaining today.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
