import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShieldAlert, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Login() {
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: 'admin@aiwatch.local', password: 'password123' }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, data);
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        // Force refresh so socket picks up the new token implicitly
        window.location.href = '/';
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setErrorMsg('Invalid email or password.');
      } else {
        setErrorMsg('Node Backend unreachable or invalid credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-500/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="glass-card w-full max-w-md p-8 relative z-10 border border-base-700/50 shadow-2xl">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)] mb-4 animate-glow-pulse">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-400">
            AiWatch SOC
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Secure Analyst Gateway</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
              <input 
                type="email"
                {...register("email", { required: "Email is required" })}
                className="input-field pl-10"
                placeholder="analyst@soc.local"
              />
            </div>
            {errors.email && <p className="text-danger-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
              <input 
                type="password"
                {...register("password", { required: "Password is required" })}
                className="input-field pl-10"
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-danger-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {errorMsg && (
            <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm px-4 py-3 rounded-lg">
              {errorMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-primary flex justify-center items-center py-3 mt-4"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Authenticate <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
          
        </form>
        
        <p className="text-center text-xs text-gray-500 mt-8">
          Unauthorised access is strictly prohibited & logged.
        </p>

      </div>
    </div>
  );
}
