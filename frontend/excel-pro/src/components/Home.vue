<template>
    <div>
      <form @submit.prevent="uploadFile">
        <input type="file" @change="handleFileChange" accept=".xlsx, .xls" />
        <button type="submit">Subir Archivo</button>
      </form>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        file: null,
      };
    },
    methods: {
      handleFileChange(event) {
        this.file = event.target.files[0];
      },
      async uploadFile() {
        if (!this.file) {
          alert('Por favor selecciona un archivo primero');
          return;
        }
  
        const formData = new FormData();
        formData.append('file', this.file);
  
        try {
          const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          console.log(result); // Aquí puedes manejar la respuesta del servidor
        } catch (error) {
          console.error('Error al subir el archivo:', error);
        }
      },
    },
  };
  </script>
  