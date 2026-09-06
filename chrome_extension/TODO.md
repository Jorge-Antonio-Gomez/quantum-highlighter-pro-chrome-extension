# Pendientes

## Sidebar

- [ ] Integración de edición de comentarios en la barra lateral.

## Varios

- [X] Actualizar el readme.md con los idiomas precisos:
    - [ ] pt -> pt_BR
    - [ ] zh -> zh_CN

- [ ] Actualizar el readme.md con el enlace a la página de la tienda de Chrome (ahora es un mockup).

- [ ] Verificar que no se eliminen o se superpongan configuraciones o stats al actualizar la extensión.

## Cumplimiento Chrome Web Store (políticas vigentes desde 2026-08-01)

- [x] Aviso dentro de la extensión cuando una actualización cambie qué datos se guardan o dónde (`disclosure.js`: página de bienvenida, aviso en página, sidebar y panel; el SW marca las actualizaciones). Al cambiar prácticas: subir `PRACTICES_VERSION`, añadir la lista en `CHANGES` y sus claves i18n.
- [ ] Revisar la declaración Trader / Non-trader (DSA de la UE) en el Developer Dashboard ahora que los enlaces de apoyo van a Stripe.
- [ ] En cada release: actualizar la tabla de cambios de prácticas de PRIVACY_POLICY.md, la fecha "Last Updated" y la tabla de Release Notes del README; comprobar el checklist de PERSMISSIONS_AND_DATA_USAGE.md §5.
