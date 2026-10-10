import { useState } from "react";
import { useListResources, useCreateResource, getListResourcesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Upload, Search, Link as LinkIcon, Video, FileQuestion } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ResourceKind } from "@workspace/api-client-react";

const createSchema = z.object({
  title: z.string().min(3).max(100),
  kind: z.enum(['pdf', 'notes', 'link', 'video', 'pyq'] as const),
  tag: z.string().min(2),
});

export default function Resources() {
  const queryClient = useQueryClient();
  const { data: resources, isLoading } = useListResources();
  const createResource = useCreateResource();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", kind: "pdf", tag: "" }
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createResource.mutate({ data: data as any }, {
      onSuccess: () => {
        toast.success("Resource uploaded!");
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListResourcesQueryKey() });
      }
    });
  };

  const filtered = resources?.filter(r => r.title.toLowerCase().includes(search.toLowerCase()) || r.tag.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (kind: ResourceKind) => {
    switch (kind) {
      case 'pdf': return <FileText className="w-8 h-8 text-red-500" />;
      case 'notes': return <FileText className="w-8 h-8 text-blue-500" />;
      case 'link': return <LinkIcon className="w-8 h-8 text-emerald-500" />;
      case 'video': return <Video className="w-8 h-8 text-purple-500" />;
      case 'pyq': return <FileQuestion className="w-8 h-8 text-amber-500" />;
      default: return <FileText className="w-8 h-8 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Resource Hub</h2>
          <p className="text-muted-foreground text-sm mt-1">Shared notes, PDFs, and links from your circles.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="hover-elevate gap-2"><Upload className="h-4 w-4" /> Upload Resource</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Resource</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="kind" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="notes">Text Notes</SelectItem>
                        <SelectItem value="link">Web Link</SelectItem>
                        <SelectItem value="video">Video Lecture</SelectItem>
                        <SelectItem value="pyq">Past Year Question</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="tag" render={({ field }) => (
                  <FormItem><FormLabel>Subject Tag</FormLabel><FormControl><Input placeholder="E.g. Data Structures" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createResource.isPending}>Upload</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search resources..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(res => (
            <Card key={res.id} className="hover-elevate group cursor-pointer transition-colors hover:border-primary/50">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="bg-muted/50 p-3 rounded-xl shrink-0 group-hover:bg-background transition-colors">
                  {getIcon(res.kind)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base line-clamp-1 mb-1 group-hover:text-primary transition-colors">{res.title}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{res.tag}</Badge>
                    <span className="text-[10px] text-muted-foreground">{res.circleName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>{res.sizeKb > 1024 ? `${(res.sizeKb/1024).toFixed(1)} MB` : `${res.sizeKb} KB`}</span>
                    <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {res.downloads}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 text-muted-foreground border-dashed border rounded-xl">No resources found.</div>
      )}
    </div>
  );
}
