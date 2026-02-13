document.addEventListener('DOMContentLoaded', () => 
{
    const user = JSON.parse(localStorage.getItem('gd_user'));

    if (!user) 
    {
        window.location.href = 'login.html';
        return;
    }

    const editBtn = document.getElementById('edit-toggle-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const viewMode = document.getElementById('view-mode');
    const editMode = document.getElementById('edit-mode');
    const form = document.getElementById('settings-form');

    const profileInitials = document.getElementById('profile-initials');

    function loadUserData() {
        if (profileInitials) {
            profileInitials.textContent = user.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();
        }

        document.getElementById('view-name').textContent = user.name;
        document.getElementById('view-email').textContent = user.email;
        document.getElementById('view-bio').textContent = user.bio || "No bio provided.";

        document.getElementById('set-name').value = user.name;
        document.getElementById('set-email').value = user.email;
        document.getElementById('set-bio').value = user.bio || "";
    }

    loadUserData();

    editBtn.addEventListener('click', () => {
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        
        editBtn.classList.add('invisible'); 
    });

    cancelBtn.addEventListener('click', () => {
        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
        
        editBtn.classList.remove('invisible');

        loadUserData();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.textContent = "Saving...";
        submitBtn.disabled = true;

        setTimeout(() => {
            user.name = document.getElementById('set-name').value;
            user.bio = document.getElementById('set-bio').value;

            localStorage.setItem('gd_user', JSON.stringify(user));

            loadUserData();

            viewMode.classList.remove('hidden');
            editMode.classList.add('hidden');
            editBtn.classList.remove('invisible');

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            console.log("Profile updated successfully!");
        }, 600);
    });

    const deleteBtn = document.getElementById('delete-account-btn');

    if (deleteBtn) 
    {
        deleteBtn.addEventListener('click', () => 
        {
        const confirmed = confirm("Are you sure you want to delete your account? This will permanently remove your data and access to the platform.");

        if (confirmed) 
        {
            localStorage.removeItem('gd_user');
            alert("Your account has been successfully deleted.");
            window.location.href = 'index.html';
        }
    });
}
});