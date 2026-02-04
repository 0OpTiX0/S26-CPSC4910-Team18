const passwordInput = document.getElementById('new-password');
const saveBtn = document.getElementById('save-btn');
const bars = document.querySelectorAll('.strength-bar');

const requirements = 
{
    length:  { el: document.getElementById('req-length'),  reg: /.{8,}/ },
    upper:   { el: document.getElementById('req-upper'),   reg: /[A-Z]/ },
    number:  { el: document.getElementById('req-number'),  reg: /[0-9]/ },
    special: { el: document.getElementById('req-special'), reg: /[^A-Za-z0-9]/ }
};

passwordInput.addEventListener('input', () => 
{
    const val = passwordInput.value;
    let score = 0;

    Object.values(requirements).forEach(item => 
    {
        if (item.reg.test(val)) 
        {
            item.el.classList.replace('text-slate-400', 'text-emerald-600');
            score++;
        } 
        else 
        {
            item.el.classList.replace('text-emerald-600', 'text-slate-400');
        }
    });

    const colors = ['bg-slate-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
    
    bars.forEach((bar, index) => 
    {
        bar.className = 'strength-bar h-1.5 w-1/4 rounded-full transition-all duration-300 ' + colors[0];
        
        if (index < score) 
        {
            bar.classList.replace(colors[0], colors[score]);
        }
    });

    if (score === 4) 
    {
        saveBtn.disabled = false;
        saveBtn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-100 cursor-pointer";
    } 
    else 
    {
        saveBtn.disabled = true;
        saveBtn.className = "w-full bg-slate-200 text-slate-400 font-bold py-3 rounded-xl transition-all cursor-not-allowed";
    }
});

document.getElementById('password-form').addEventListener('submit', (e) => 
{
    e.preventDefault();
    window.location.href = 'success.html';
});