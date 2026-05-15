import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useBlockBackButton = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("email");

    // If user is not logged in, redirect immediately
    if (!token) {
      navigate("/", { replace: true });
    }

    const handlePopState = () => {
      const tokenCheck = localStorage.getItem("email");
      if (!tokenCheck) {
        navigate("/", { replace: true });
      } else {
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);
};

export default useBlockBackButton;
