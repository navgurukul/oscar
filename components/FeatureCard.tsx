interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl p-8 shadow-md hover:shadow-2xl hover:scale-105 transition-all duration-300 border-2 border-gray-200 hover:border-purple-400 flex flex-col items-center text-center cursor-pointer overflow-hidden">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/0 to-indigo-500/0 group-hover:from-purple-500/10 group-hover:via-purple-500/20 group-hover:to-indigo-500/10 transition-all duration-300 pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-indigo-500 transition-all duration-300">{title}</h3>
        <p className="text-gray-600 group-hover:text-gray-700 transition-colors duration-300">{description}</p>
      </div>
    </div>
  )
}

