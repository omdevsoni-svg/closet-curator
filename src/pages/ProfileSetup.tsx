import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, User, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setter(url);
    }
  };

  const isComplete = name.trim() && faceImage && bodyImage;

  return (
    <div className="min-h-screen bg-background px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md"
      >
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
          Set up your profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          Upload your photos so our AI stylist can create personalized outfits.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="mt-2 h-12 rounded-xl border-border bg-card font-body text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ImageUploadCard
              label="Face Photo"
              image={faceImage}
              icon={<User className="h-6 w-6" />}
              onUpload={(e) => handleImageUpload(e, setFaceImage)}
            />
            <ImageUploadCard
              label="Full Body"
              image={bodyImage}
              icon={<Camera className="h-6 w-6" />}
              onUpload={(e) => handleImageUpload(e, setBodyImage)}
            />
          </div>

          <Button
            onClick={() => {
              if (name.trim()) localStorage.setItem("sv_user_name", name.trim());
              navigate("/home");
            }}
            disabled={!isComplete}
            className="h-14 w-full rounded-2xl bg-primary text-primary-foreground font-display text-base font-semibold tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const ImageUploadCard = ({
  label,
  image,
  icon,
  onUpload,
}: {
  label: string;
  image: string | null;
  icon: React.ReactNode;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <label className="group cursor-pointer">
    <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card transition-colors group-hover:border-muted-foreground"
    >
      {image ? (
        <img
          src={image}
          alt={label}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="text-muted-foreground">{icon}</div>
          <span className="mt-2 text-xs font-medium text-muted-foreground font-body">
            {label}
          </span>
        </>
      )}
    </motion.div>
  </label>
);

export default ProfileSetup;
