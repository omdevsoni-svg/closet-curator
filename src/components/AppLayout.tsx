import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
