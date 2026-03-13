import { User, Settings, LogOut, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const menuItems = [
  { label: "Edit Profile", icon: User },
  { label: "Preferences", icon: Settings },
  { label: "Log Out", icon: LogOut },
];

const Profile = () => {
  return (
    <div className="px-5 pt-8">
      <h1 className="text-2xl font-display font-bold tracking-tight">
        Profile
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex items-center gap-4 rounded-2xl bg-card p-5"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <User className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">
            Style Enthusiast
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            6 items in closet
          </p>
        </div>
      </motion.div>

      <div className="mt-6 space-y-2">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex w-full items-center justify-between rounded-2xl bg-card px-5 py-4 transition-colors hover:bg-card/80"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium font-body text-foreground">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default Profile;
