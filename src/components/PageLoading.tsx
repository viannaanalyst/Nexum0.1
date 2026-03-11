const PageLoading = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo_X_nexum.svg"
          className="w-16 animate-pulse-loading"
          alt="Nexum Logo"
        />
        <div className="flex items-center text-base text-gray-400 tracking-wide">
          Carregando<span className="dots"></span>
        </div>
      </div>
    </div>
  )
}

export default PageLoading
