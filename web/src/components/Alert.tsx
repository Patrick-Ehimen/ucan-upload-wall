import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

export function Alert({ type, message, onClose }: AlertProps) {
  const isSuccess = type === 'success';

  return (
    <div
      className={`
        fixed top-6 right-6 max-w-md w-full shadow-lg rounded-lg p-4 flex items-start gap-3
        ${isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}
        animate-in slide-in-from-top-5 duration-300
      `}
    >
      {isSuccess ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      )}
      <div className={`flex-1 text-sm ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
        {message.split('\n').map((line, index) => (
          <div key={index} className={index === 0 ? 'font-medium' : 'font-normal mt-1'}>
            {line}
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className={`
          p-1 rounded hover:bg-opacity-20 transition-colors
          ${isSuccess ? 'hover:bg-green-600' : 'hover:bg-red-600'}
        `}
      >
        <X className={`w-4 h-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} />
      </button>
    </div>
  );
}
