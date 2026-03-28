const Logo = ({ className = "h-9 w-9" }: { className?: string }) => (
    <img
          src="/icons/logo.svg"
          alt="StyleOS"
          width={512}
          height={512}
          className={`${className} rounded-xl object-contain`}
          style={{ imageRendering: "auto" }}
          draggable={false}
        />
  );

export default Logo;
