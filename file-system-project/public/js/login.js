// public/js/login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const { value: formValues } = await Swal.fire({
                title: 'Superadmin Login',
                html: `
                    <input id="swal-input1" class="swal2-input" placeholder="Username">
                    <input id="swal-input2" class="swal2-input" type="password" placeholder="Password">
                `,
                focusConfirm: false,
                preConfirm: () => {
                    return [
                        document.getElementById('swal-input1').value,
                        document.getElementById('swal-input2').value
                    ]
                },
                showCancelButton: true,
                confirmButtonText: 'Login'
            });

            if (formValues) {
                const [username, password] = formValues;
                
                try {
                    // const response = await fetch('/api/auth/login', {
                    const response = await fetch('/fs-api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const result = await response.json();
                    console.log('Frontend received this result object:', result);
                    console.log('The value of result.redirectUrl is:', result.redirectUrl);

                    if (!response.ok) {
                        throw new Error(result.message || 'Login failed');
                    }
                    
                    
                    // ถ้าสำเร็จ ให้ Redirect
                    window.location.href = result.redirectUrl;
                    // window.location.href = '/files/admin/';

                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Failed',
                        text: error.message,
                        text: error.message
                    });
                }
            }
        });
    }
});