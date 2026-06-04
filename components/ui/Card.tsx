type CardProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export default function Card({ children, onClick, className = "" }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white/5 border border-white/8 rounded-3xl p-5 transition-all ${
        onClick ? "cursor-pointer active:scale-95 hover:bg-white/8" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}