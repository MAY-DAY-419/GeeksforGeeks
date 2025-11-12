// Admin Login Handler with Security Enhancements
(function() {
    const modal = document.getElementById('admin-login-modal');
    const loginBtn = document.getElementById('admin-login-btn');
    const loginBtnMobile = document.getElementById('admin-login-btn-mobile');
    const closeBtn = document.getElementById('close-modal');
    const loginForm = document.getElementById('admin-login-form');
    const errorDiv = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');

    // Simple hash function for password (SHA-256)
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // Generate secure session token
    function generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Open modal
    function openModal() {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        // Initialize feather icons for the close button
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Close modal
    function closeModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
        errorDiv.classList.add('hidden');
        loginForm.reset();
    }

    // Show error
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    // Event listeners
    if (loginBtn) {
        loginBtn.addEventListener('click', openModal);
    }
    if (loginBtnMobile) {
        loginBtnMobile.addEventListener('click', openModal);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('admin-email').value.trim().toLowerCase();
        const password = document.getElementById('admin-password').value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        errorDiv.classList.add('hidden');

        try {
            // Hash the password
            const hashedPassword = await hashPassword(password);

            // Check if admin exists in the admins table
            const { data: adminData, error: queryError } = await window.supabaseClient
                .from('admins')
                .select('id, email, password_hash')
                .eq('email', email)
                .single();

            if (queryError || !adminData) {
                console.error('Query error:', queryError);
                showError('Invalid email or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }

            // Compare hashed passwords
            if (adminData.password_hash === hashedPassword) {
                // Generate secure session token
                const sessionToken = generateSessionToken();
                const sessionExpiry = Date.now() + (2 * 60 * 60 * 1000); // 2 hours

                // Store session with expiry
                sessionStorage.setItem('gfg_admin_id', adminData.id);
                sessionStorage.setItem('gfg_admin_email', adminData.email);
                sessionStorage.setItem('gfg_session_token', sessionToken);
                sessionStorage.setItem('gfg_session_expiry', sessionExpiry.toString());
                
                // Log the successful login (optional - add login_logs table)
                try {
                    await window.supabaseClient
                        .from('admin_login_logs')
                        .insert({
                            admin_id: adminData.id,
                            login_time: new Date().toISOString(),
                            ip_address: 'N/A',
                            user_agent: navigator.userAgent,
                            success: true
                        });
                } catch (logError) {
                    // Fail silently if table doesn't exist
                    console.log('Login log failed (table may not exist):', logError);
                }
                
                // Redirect to admin page
                window.location.href = 'admin.html';
            } else {
                showError('Invalid email or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }

        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
})();
