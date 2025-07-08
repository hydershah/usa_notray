console.log('🔧 Clearing expired authentication...'); localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'
