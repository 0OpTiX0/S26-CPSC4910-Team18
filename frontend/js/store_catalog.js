document.addEventListener('DOMContentLoaded', async () => {

    const pointsDisplay = document.getElementById('display-points');
    
    const session = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    if (!session || !session.userId) 
    {
        if (pointsDisplay) pointsDisplay.textContent = "0";
        return;
    }

    async function loadUserPoints() 
    {
        try {
            const points = await window.API.request(`/points/${session.userId}`);
            
            if (pointsDisplay) 
            {
                pointsDisplay.textContent = points !== null ? points : "0";
            }
        } catch (error) {
            console.error("Failed to load points:", error);
            if (pointsDisplay) pointsDisplay.textContent = "—";
        }
    }

    loadUserPoints();
});