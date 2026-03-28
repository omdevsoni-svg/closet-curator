const Logo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <img
    src="/icons/icon-512.png"
    alt="StyleOS"
    className={`${className} rounded-lg object-contain`}
  />
);

export default Logo;
