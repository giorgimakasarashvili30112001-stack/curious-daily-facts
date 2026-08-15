import { Facebook, Instagram, Linkedin, Link2, MessageCircle, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type ShareTarget = {
  key: string;
  label: string;
  icon: typeof Facebook;
  onSelect: (ctx: { url: string; text: string }) => void | Promise<void>;
};

const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

const targets: ShareTarget[] = [
  {
    key: "x",
    label: "X",
    icon: Twitter,
    onSelect: ({ url, text }) =>
      void open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      ),
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: Facebook,
    onSelect: ({ url }) =>
      void open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
  },
  {
    key: "messenger",
    label: "Messenger",
    icon: MessageCircle,
    onSelect: ({ url }) => void open(`fb-messenger://share/?link=${encodeURIComponent(url)}`),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    onSelect: ({ url }) =>
      void open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`),
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    onSelect: async ({ url, text }) => {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Caption copied — paste it into your Instagram story or post");
      open("https://www.instagram.com/");
    },
  },
  {
    key: "copy",
    label: "Copy link",
    icon: Link2,
    onSelect: async ({ url }) => {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    },
  },
];

export function ShareSheet({ title, text, url }: { title: string; text: string; url: string }) {
  const onNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title, text, url });
    } catch {
      // dismissed
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </button>
      </DrawerTrigger>
      <DrawerContent className="border-border bg-card">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-display text-xl">Share this explainer</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">{title}</DrawerDescription>
        </DrawerHeader>

        <div className="grid grid-cols-3 gap-3 px-4 pb-4">
          {targets.map((target) => (
            <button
              key={target.key}
              type="button"
              onClick={() => void target.onSelect({ url, text })}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-secondary px-2 py-4 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted"
            >
              <target.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              {target.label}
            </button>
          ))}
        </div>

        {typeof navigator !== "undefined" && "share" in navigator ? (
          <div className="px-4 pb-6">
            <button
              type="button"
              onClick={() => void onNativeShare()}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              More options
            </button>
          </div>
        ) : (
          <div className="pb-6" />
        )}
      </DrawerContent>
    </Drawer>
  );
}
