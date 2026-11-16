(() => {
  const stage=document.querySelector('.stage');
  const form=document.querySelector('.login-form');
  const email=form.elements.email, password=form.elements.password;
  const backdrop=document.querySelector('.dialog-backdrop');
  const title=document.querySelector('#dialog-title'), feedback=document.querySelector('#feedback');
  const close=document.querySelector('.dialog-close');
  let previousFocus;

  function resize(){
    const w=window.innerWidth,h=window.innerHeight;
    const portrait=w/h<1.15;
    const scale=portrait?Math.min(w/790,h/941):Math.min(w/1672,h/941);
    const left=portrait?w/2+(836-425)*scale:w/2;
    stage.style.setProperty('--scale',scale);
    stage.style.setProperty('--left',`${left}px`);
  }
  function showDialog(heading,message){
    previousFocus=document.activeElement;
    title.textContent=heading;feedback.textContent=message;
    backdrop.hidden=false;close.focus();
  }
  function hideDialog(){backdrop.hidden=true;previousFocus?.focus();}
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!email.value.trim()||!email.validity.valid){email.focus();showDialog('ПРОВЕРЬ ПОЧТУ','Введи корректный адрес электронной почты.');return;}
    if(!password.value){password.focus();showDialog('ВВЕДИ ПАРОЛЬ','Для демонстрации заполни поле пароля.');return;}
    showDialog('ЭКРАН ВХОДА','Это демонстрация интерфейса. Подключение входа в аккаунт появится на следующем этапе.');
    password.value='';
  });
  form.querySelector('.create').addEventListener('click',()=>showDialog('СОЗДАТЬ АККАУНТ','Регистрация будет подключена при создании аккаунтов. Сейчас это демонстрация экрана.'));
  form.querySelector('.guest').addEventListener('click',()=>showDialog('ИГРА ГОСТЕМ','Гостевой вход появится при объединении экранов игры.'));
  document.querySelector('.settings-hit').addEventListener('click',()=>showDialog('НАСТРОЙКИ','Настройки игры будут доступны после объединения экранов.'));
  document.querySelector('.language-hit').addEventListener('click',()=>showDialog('ЯЗЫК','В демонстрационной версии доступен русский язык.'));
  close.addEventListener('click',hideDialog);
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)hideDialog();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!backdrop.hidden)hideDialog();});
  window.addEventListener('resize',resize);resize();
})();
