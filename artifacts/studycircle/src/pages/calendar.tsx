import { useState } from "react";
import { useListCalendarEvents, useCreateCalendarEvent, getListCalendarEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, Plus } from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";

export default function CalendarView() {
  const queryClient = useQueryClient();
  const { data: events, isLoading } = useListCalendarEvents();
  const createEvent = useCreateCalendarEvent();
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<any>("mock-test");
  const [time, setTime] = useState("10:00");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title) return;
    
    // Combine date and time
    const [hours, mins] = time.split(':');
    const startStr = new Date(date);
    startStr.setHours(parseInt(hours), parseInt(mins));
    
    const endStr = new Date(startStr);
    endStr.setHours(endStr.getHours() + 1);

    createEvent.mutate({ 
      data: { 
        title, 
        kind, 
        startsAt: startStr.toISOString(), 
        endsAt: endStr.toISOString() 
      } 
    }, {
      onSuccess: () => {
        toast.success("Event added");
        setOpen(false);
        setTitle("");
        queryClient.invalidateQueries({ queryKey: getListCalendarEventsQueryKey() });
      }
    });
  };

  const selectedDayEvents = events?.filter(e => date && isSameDay(parseISO(e.startsAt), date)) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schedule</h2>
          <p className="text-muted-foreground text-sm mt-1">Plan your mock tests, revisions, and classes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="hover-elevate gap-2"><Plus className="h-4 w-4" /> Add Event</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium">Event Title</label><Input value={title} onChange={e=>setTitle(e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock-test">Mock Test</SelectItem>
                      <SelectItem value="group-study">Group Study</SelectItem>
                      <SelectItem value="mentor-class">Class</SelectItem>
                      <SelectItem value="revision">Revision</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Time</label><Input type="time" value={time} onChange={e=>setTime(e.target.value)} required /></div>
              </div>
              <DialogFooter className="pt-4"><Button type="submit" disabled={createEvent.isPending}>Add to Calendar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 p-2 bg-card shadow-sm h-fit">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="w-full mx-auto"
            modifiers={{
              hasEvent: (d) => !!events?.some(e => isSameDay(parseISO(e.startsAt), d))
            }}
            modifiersStyles={{
              hasEvent: { fontWeight: 'bold', border: '2px solid hsl(var(--primary))' }
            }}
          />
        </Card>
        
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-between">
            <span>{date ? format(date, 'EEEE, MMMM d') : 'Select a date'}</span>
            <span className="text-sm text-muted-foreground font-normal">{selectedDayEvents.length} events</span>
          </h3>
          
          {isLoading ? (
             <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map(event => (
                <Card key={event.id} className="border-l-4 shadow-sm" style={{ borderLeftColor: event.color }}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-base mb-1">{event.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(parseISO(event.startsAt), 'h:mm a')}</span>
                        {event.circleName && <span>• {event.circleName}</span>}
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-muted/50" style={{ color: event.color }}>
                      {event.kind.replace('-', ' ')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-12 text-muted-foreground border-dashed border rounded-xl bg-card">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No events scheduled for this day.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
