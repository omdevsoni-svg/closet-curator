const Logo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <img
    src="/logo.png"
    alt="StyleOS"
    className={`${className} rounded-lg object-contain`}
  />
);

export default Logo;
