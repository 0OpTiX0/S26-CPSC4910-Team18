let attempts = 0;
const MAX_ATTEMPTS = 3;

document.getElementById('password-form').addEventListener('submit', (e) => 
    {
        e.preventDefault();
        attempts++;

        if(attempts > MAX_ATTEMPTS)
        {
            alert('Maximum login attempts exceeded. Please try again later.');
            triggerLockout();
        }
        else
        {
            alert(`Login attempt ${attempts} failed. Please try again.`);
        }
    });
    
function triggerLockout() 
{
    const screen = document.getElementById('lockout-screen');
    const timerDisplay = document.getElementById('lockout-timer');
    screen.classList.remove('hidden');

    // Simple 30-minute countdown simulation
    let seconds = 1800; 
    const interval = setInterval(() => {
        seconds--;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        
        if (seconds <= 0) {
            clearInterval(interval);
            screen.classList.add('hidden');
        }
    }, 1000);
}