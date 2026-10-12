-- Entries created from Suggestions before they took their area's type were all General;
-- move them to that type by their title (the idea's title, maybe with a year or instalment).
-- They were also created in English; the Family uses Portuguese, so their titles and notes follow.
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'activity'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'activity') AND (`title` = 'Aula de música' OR `title` LIKE 'Aula de música %' OR `title` = 'Catechism' OR `title` LIKE 'Catechism %' OR `title` = 'Catequese' OR `title` LIKE 'Catequese %' OR `title` = 'Escuteiros' OR `title` LIKE 'Escuteiros %' OR `title` = 'Ginásio' OR `title` LIKE 'Ginásio %' OR `title` = 'Gym' OR `title` LIKE 'Gym %' OR `title` = 'Music lesson' OR `title` LIKE 'Music lesson %' OR `title` = 'Natação' OR `title` LIKE 'Natação %' OR `title` = 'Scouts' OR `title` LIKE 'Scouts %' OR `title` = 'Swimming' OR `title` LIKE 'Swimming %');
--> statement-breakpoint
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'appointment'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'appointment') AND (`title` = 'Book the dentist' OR `title` LIKE 'Book the dentist %' OR `title` = 'Book the eye doctor' OR `title` LIKE 'Book the eye doctor %' OR `title` = 'Book the family doctor' OR `title` LIKE 'Book the family doctor %' OR `title` = 'Car inspection' OR `title` LIKE 'Car inspection %' OR `title` = 'Car service' OR `title` LIKE 'Car service %' OR `title` = 'Check the tyre pressure' OR `title` LIKE 'Check the tyre pressure %' OR `title` = 'Check the vaccination record' OR `title` LIKE 'Check the vaccination record %' OR `title` = 'Entregar o IRS' OR `title` LIKE 'Entregar o IRS %' OR `title` = 'Fazer as análises anuais' OR `title` LIKE 'Fazer as análises anuais %' OR `title` = 'File the IRS (income tax) return' OR `title` LIKE 'File the IRS (income tax) return %' OR `title` = 'Have the yearly blood tests' OR `title` LIKE 'Have the yearly blood tests %' OR `title` = 'Inspeção do carro' OR `title` LIKE 'Inspeção do carro %' OR `title` = 'Marcar o dentista' OR `title` LIKE 'Marcar o dentista %' OR `title` = 'Marcar o médico de família' OR `title` LIKE 'Marcar o médico de família %' OR `title` = 'Marcar o oftalmologista' OR `title` LIKE 'Marcar o oftalmologista %' OR `title` = 'Renew the Citizen Card' OR `title` LIKE 'Renew the Citizen Card %' OR `title` = 'Renew the driving licence' OR `title` LIKE 'Renew the driving licence %' OR `title` = 'Renew the passport' OR `title` LIKE 'Renew the passport %' OR `title` = 'Renovar a carta de condução' OR `title` LIKE 'Renovar a carta de condução %' OR `title` = 'Renovar o Cartão de Cidadão' OR `title` LIKE 'Renovar o Cartão de Cidadão %' OR `title` = 'Renovar o passaporte' OR `title` LIKE 'Renovar o passaporte %' OR `title` = 'Revisão do carro' OR `title` LIKE 'Revisão do carro %' OR `title` = 'Ver a pressão dos pneus' OR `title` LIKE 'Ver a pressão dos pneus %' OR `title` = 'Ver o boletim de vacinas' OR `title` LIKE 'Ver o boletim de vacinas %');
--> statement-breakpoint
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'home'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'home') AND (`title` = 'Bleed the radiators' OR `title` LIKE 'Bleed the radiators %' OR `title` = 'Change the bed sheets' OR `title` LIKE 'Change the bed sheets %' OR `title` = 'Change the smoke alarm batteries' OR `title` LIKE 'Change the smoke alarm batteries %' OR `title` = 'Clean the air conditioning filters' OR `title` LIKE 'Clean the air conditioning filters %' OR `title` = 'Clean the blinds and windows' OR `title` LIKE 'Clean the blinds and windows %' OR `title` = 'Clean the house' OR `title` LIKE 'Clean the house %' OR `title` = 'Clear the gutters' OR `title` LIKE 'Clear the gutters %' OR `title` = 'Groceries' OR `title` LIKE 'Groceries %' OR `title` = 'Limpar a chaminé' OR `title` LIKE 'Limpar a chaminé %' OR `title` = 'Limpar as caleiras' OR `title` LIKE 'Limpar as caleiras %' OR `title` = 'Limpar estores e vidros' OR `title` LIKE 'Limpar estores e vidros %' OR `title` = 'Limpar os filtros do ar condicionado' OR `title` LIKE 'Limpar os filtros do ar condicionado %' OR `title` = 'Limpeza da casa' OR `title` LIKE 'Limpeza da casa %' OR `title` = 'Mudar os lençóis' OR `title` LIKE 'Mudar os lençóis %' OR `title` = 'Purgar os radiadores' OR `title` LIKE 'Purgar os radiadores %' OR `title` = 'Regar as plantas' OR `title` LIKE 'Regar as plantas %' OR `title` = 'Revisão da caldeira ou do esquentador' OR `title` LIKE 'Revisão da caldeira ou do esquentador %' OR `title` = 'Service the boiler or water heater' OR `title` LIKE 'Service the boiler or water heater %' OR `title` = 'Supermercado' OR `title` LIKE 'Supermercado %' OR `title` = 'Sweep the chimney' OR `title` LIKE 'Sweep the chimney %' OR `title` = 'Trocar as pilhas do detetor de fumo' OR `title` LIKE 'Trocar as pilhas do detetor de fumo %' OR `title` = 'Water the plants' OR `title` LIKE 'Water the plants %');
--> statement-breakpoint
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'payment'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'payment') AND (`title` LIKE 'Debit: %' OR `title` LIKE 'Débito: %' OR `title` = 'Pagar a escola ou o ATL' OR `title` LIKE 'Pagar a escola ou o ATL %' OR `title` = 'Pagar a internet e o telemóvel' OR `title` LIKE 'Pagar a internet e o telemóvel %' OR `title` = 'Pagar a luz' OR `title` LIKE 'Pagar a luz %' OR `title` = 'Pagar a renda ou a prestação da casa' OR `title` LIKE 'Pagar a renda ou a prestação da casa %' OR `title` = 'Pagar a água' OR `title` LIKE 'Pagar a água %' OR `title` = 'Pagar o IMI' OR `title` LIKE 'Pagar o IMI %' OR `title` = 'Pagar o IUC' OR `title` LIKE 'Pagar o IUC %' OR `title` = 'Pagar o condomínio' OR `title` LIKE 'Pagar o condomínio %' OR `title` = 'Pagar o ginásio' OR `title` LIKE 'Pagar o ginásio %' OR `title` = 'Pagar o gás' OR `title` LIKE 'Pagar o gás %' OR `title` = 'Pagar o seguro da casa' OR `title` LIKE 'Pagar o seguro da casa %' OR `title` = 'Pagar o seguro de saúde' OR `title` LIKE 'Pagar o seguro de saúde %' OR `title` = 'Pagar o seguro do carro' OR `title` LIKE 'Pagar o seguro do carro %' OR `title` = 'Pay the IMI (property tax)' OR `title` LIKE 'Pay the IMI (property tax) %' OR `title` = 'Pay the IUC (road tax)' OR `title` LIKE 'Pay the IUC (road tax) %' OR `title` = 'Pay the building fees' OR `title` LIKE 'Pay the building fees %' OR `title` = 'Pay the car insurance' OR `title` LIKE 'Pay the car insurance %' OR `title` = 'Pay the electricity' OR `title` LIKE 'Pay the electricity %' OR `title` = 'Pay the gas' OR `title` LIKE 'Pay the gas %' OR `title` = 'Pay the gym' OR `title` LIKE 'Pay the gym %' OR `title` = 'Pay the health insurance' OR `title` LIKE 'Pay the health insurance %' OR `title` = 'Pay the home insurance' OR `title` LIKE 'Pay the home insurance %' OR `title` = 'Pay the internet and phone' OR `title` LIKE 'Pay the internet and phone %' OR `title` = 'Pay the rent or mortgage' OR `title` LIKE 'Pay the rent or mortgage %' OR `title` = 'Pay the school or after-school club' OR `title` LIKE 'Pay the school or after-school club %' OR `title` = 'Pay the water' OR `title` LIKE 'Pay the water %');
--> statement-breakpoint
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'pet'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'pet') AND (`title` = 'Consulta no veterinário' OR `title` LIKE 'Consulta no veterinário %' OR `title` = 'Desparasitar' OR `title` LIKE 'Desparasitar %' OR `title` = 'Deworm' OR `title` LIKE 'Deworm %' OR `title` = 'Rabies vaccine' OR `title` LIKE 'Rabies vaccine %' OR `title` = 'Vacina antirrábica' OR `title` LIKE 'Vacina antirrábica %' OR `title` = 'Vet check-up' OR `title` LIKE 'Vet check-up %');
--> statement-breakpoint
UPDATE `entry` SET `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'school'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `entry_type_id` = (SELECT `id` FROM `entry_type` WHERE `builtin_key` = 'general') AND EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'school') AND (`title` = 'Buy the school supplies' OR `title` LIKE 'Buy the school supplies %' OR `title` = 'Comprar o material escolar' OR `title` LIKE 'Comprar o material escolar %' OR `title` = 'Inscrever nas atividades' OR `title` LIKE 'Inscrever nas atividades %' OR `title` = 'Pedir os vales dos manuais' OR `title` LIKE 'Pedir os vales dos manuais %' OR `title` = 'Renew the school enrolment' OR `title` LIKE 'Renew the school enrolment %' OR `title` = 'Renovar a matrícula da escola' OR `title` LIKE 'Renovar a matrícula da escola %' OR `title` = 'Request the textbook vouchers' OR `title` LIKE 'Request the textbook vouchers %' OR `title` = 'Sign up for activities' OR `title` LIKE 'Sign up for activities %');
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar a escola ou o ATL' || substr(`title`, 36), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the school or after-school club' OR `title` LIKE 'Pay the school or after-school club %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Revisão da caldeira ou do esquentador' || substr(`title`, 35), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Service the boiler or water heater' OR `title` LIKE 'Service the boiler or water heater %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Limpar os filtros do ar condicionado' || substr(`title`, 35), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the air conditioning filters' OR `title` LIKE 'Clean the air conditioning filters %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Trocar as pilhas do detetor de fumo' || substr(`title`, 33), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Change the smoke alarm batteries' OR `title` LIKE 'Change the smoke alarm batteries %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Entregar o IRS' || substr(`title`, 33), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'File the IRS (income tax) return' OR `title` LIKE 'File the IRS (income tax) return %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pedir os vales dos manuais' || substr(`title`, 30), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Request the textbook vouchers' OR `title` LIKE 'Request the textbook vouchers %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Limpar estores e vidros' || substr(`title`, 29), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the blinds and windows' OR `title` LIKE 'Clean the blinds and windows %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Ver o boletim de vacinas' || substr(`title`, 29), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Check the vaccination record' OR `title` LIKE 'Check the vaccination record %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Fazer as análises anuais' || substr(`title`, 28), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Have the yearly blood tests' OR `title` LIKE 'Have the yearly blood tests %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o IMI' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the IMI (property tax)' OR `title` LIKE 'Pay the IMI (property tax) %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar a internet e o telemóvel' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the internet and phone' OR `title` LIKE 'Pay the internet and phone %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Renovar a matrícula da escola' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the school enrolment' OR `title` LIKE 'Renew the school enrolment %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Renovar a carta de condução' || substr(`title`, 26), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the driving licence' OR `title` LIKE 'Renew the driving licence %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: internet e telemóvel' || substr(`title`, 26), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: internet and phone' OR `title` LIKE 'Debit: internet and phone %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar a renda ou a prestação da casa' || substr(`title`, 25), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the rent or mortgage' OR `title` LIKE 'Pay the rent or mortgage %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o seguro de saúde' || substr(`title`, 25), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the health insurance' OR `title` LIKE 'Pay the health insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Ver a pressão dos pneus' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Check the tyre pressure' OR `title` LIKE 'Check the tyre pressure %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Comprar o material escolar' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Buy the school supplies' OR `title` LIKE 'Buy the school supplies %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: renda ou prestação da casa' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: rent or mortgage' OR `title` LIKE 'Debit: rent or mortgage %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: seguro de saúde' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: health insurance' OR `title` LIKE 'Debit: health insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o IUC' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the IUC (road tax)' OR `title` LIKE 'Pay the IUC (road tax) %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o seguro da casa' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the home insurance' OR `title` LIKE 'Pay the home insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Renovar o Cartão de Cidadão' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the Citizen Card' OR `title` LIKE 'Renew the Citizen Card %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Marcar o médico de família' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the family doctor' OR `title` LIKE 'Book the family doctor %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Inscrever nas atividades' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Sign up for activities' OR `title` LIKE 'Sign up for activities %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o seguro do carro' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the car insurance' OR `title` LIKE 'Pay the car insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o condomínio' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the building fees' OR `title` LIKE 'Pay the building fees %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Mudar os lençóis' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Change the bed sheets' OR `title` LIKE 'Change the bed sheets %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: seguro da casa' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: home insurance' OR `title` LIKE 'Debit: home insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: seguro do carro' || substr(`title`, 21), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: car insurance' OR `title` LIKE 'Debit: car insurance %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: condomínio' || substr(`title`, 21), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: building fees' OR `title` LIKE 'Debit: building fees %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Purgar os radiadores' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Bleed the radiators' OR `title` LIKE 'Bleed the radiators %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar a luz' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the electricity' OR `title` LIKE 'Pay the electricity %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Marcar o oftalmologista' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the eye doctor' OR `title` LIKE 'Book the eye doctor %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Renovar o passaporte' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the passport' OR `title` LIKE 'Renew the passport %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: luz' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: electricity' OR `title` LIKE 'Debit: electricity %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: escola ou ATL' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: school fees' OR `title` LIKE 'Debit: school fees %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Limpar a chaminé' || substr(`title`, 18), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Sweep the chimney' OR `title` LIKE 'Sweep the chimney %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Limpar as caleiras' || substr(`title`, 18), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clear the gutters' OR `title` LIKE 'Clear the gutters %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Marcar o dentista' || substr(`title`, 17), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the dentist' OR `title` LIKE 'Book the dentist %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Regar as plantas' || substr(`title`, 17), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Water the plants' OR `title` LIKE 'Water the plants %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Limpeza da casa' || substr(`title`, 16), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the house' OR `title` LIKE 'Clean the house %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Inspeção do carro' || substr(`title`, 15), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Car inspection' OR `title` LIKE 'Car inspection %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Vacina antirrábica' || substr(`title`, 15), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Rabies vaccine' OR `title` LIKE 'Rabies vaccine %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar a água' || substr(`title`, 14), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the water' OR `title` LIKE 'Pay the water %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Consulta no veterinário' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Vet check-up' OR `title` LIKE 'Vet check-up %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Aula de música' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Music lesson' OR `title` LIKE 'Music lesson %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: água' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: water' OR `title` LIKE 'Debit: water %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Revisão do carro' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Car service' OR `title` LIKE 'Car service %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o gás' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the gas' OR `title` LIKE 'Pay the gas %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Pagar o ginásio' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the gym' OR `title` LIKE 'Pay the gym %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: IUC' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: IUC' OR `title` LIKE 'Debit: IUC %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: IMI' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: IMI' OR `title` LIKE 'Debit: IMI %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: gás' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: gas' OR `title` LIKE 'Debit: gas %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Débito: ginásio' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: gym' OR `title` LIKE 'Debit: gym %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Supermercado' || substr(`title`, 10), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Groceries' OR `title` LIKE 'Groceries %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Catequese' || substr(`title`, 10), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Catechism' OR `title` LIKE 'Catechism %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Natação' || substr(`title`, 9), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Swimming' OR `title` LIKE 'Swimming %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Desparasitar' || substr(`title`, 7), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Deworm' OR `title` LIKE 'Deworm %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Escuteiros' || substr(`title`, 7), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Scouts' OR `title` LIKE 'Scouts %';
--> statement-breakpoint
UPDATE `entry` SET `title` = 'Ginásio' || substr(`title`, 4), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Gym' OR `title` LIKE 'Gym %';
--> statement-breakpoint
UPDATE `entry` SET `title` = replace(`title`, ' (instalment 1)', ' (1.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 1)';
--> statement-breakpoint
UPDATE `entry` SET `title` = replace(`title`, ' (instalment 2)', ' (2.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 2)';
--> statement-breakpoint
UPDATE `entry` SET `title` = replace(`title`, ' (instalment 3)', ' (3.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 3)';
--> statement-breakpoint
UPDATE `entry` SET `title` = replace(`title`, ' (instalment 4)', ' (4.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 4)';
--> statement-breakpoint
UPDATE `entry` SET `notes` = 'Pode fazer-se nos 3 meses antes desta data.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It can be done in the 3 months before this date.';
--> statement-breakpoint
UPDATE `entry` SET `notes` = 'A entrega é de 1 de abril a 30 de junho.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'The return is filed from 1 April to 30 June.';
--> statement-breakpoint
UPDATE `entry` SET `notes` = 'Paga-se no Portal das Finanças.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It is paid on the Portal das Finanças.';
--> statement-breakpoint
UPDATE `entry` SET `notes` = 'Paga-se no Portal das Finanças.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It is paid on the Portal das Finanças.';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar a escola ou o ATL' || substr(`title`, 36), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the school or after-school club' OR `title` LIKE 'Pay the school or after-school club %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Revisão da caldeira ou do esquentador' || substr(`title`, 35), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Service the boiler or water heater' OR `title` LIKE 'Service the boiler or water heater %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Limpar os filtros do ar condicionado' || substr(`title`, 35), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the air conditioning filters' OR `title` LIKE 'Clean the air conditioning filters %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Trocar as pilhas do detetor de fumo' || substr(`title`, 33), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Change the smoke alarm batteries' OR `title` LIKE 'Change the smoke alarm batteries %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Entregar o IRS' || substr(`title`, 33), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'File the IRS (income tax) return' OR `title` LIKE 'File the IRS (income tax) return %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pedir os vales dos manuais' || substr(`title`, 30), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Request the textbook vouchers' OR `title` LIKE 'Request the textbook vouchers %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Limpar estores e vidros' || substr(`title`, 29), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the blinds and windows' OR `title` LIKE 'Clean the blinds and windows %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Ver o boletim de vacinas' || substr(`title`, 29), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Check the vaccination record' OR `title` LIKE 'Check the vaccination record %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Fazer as análises anuais' || substr(`title`, 28), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Have the yearly blood tests' OR `title` LIKE 'Have the yearly blood tests %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o IMI' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the IMI (property tax)' OR `title` LIKE 'Pay the IMI (property tax) %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar a internet e o telemóvel' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the internet and phone' OR `title` LIKE 'Pay the internet and phone %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Renovar a matrícula da escola' || substr(`title`, 27), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the school enrolment' OR `title` LIKE 'Renew the school enrolment %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Renovar a carta de condução' || substr(`title`, 26), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the driving licence' OR `title` LIKE 'Renew the driving licence %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: internet e telemóvel' || substr(`title`, 26), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: internet and phone' OR `title` LIKE 'Debit: internet and phone %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar a renda ou a prestação da casa' || substr(`title`, 25), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the rent or mortgage' OR `title` LIKE 'Pay the rent or mortgage %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o seguro de saúde' || substr(`title`, 25), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the health insurance' OR `title` LIKE 'Pay the health insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Ver a pressão dos pneus' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Check the tyre pressure' OR `title` LIKE 'Check the tyre pressure %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Comprar o material escolar' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Buy the school supplies' OR `title` LIKE 'Buy the school supplies %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: renda ou prestação da casa' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: rent or mortgage' OR `title` LIKE 'Debit: rent or mortgage %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: seguro de saúde' || substr(`title`, 24), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: health insurance' OR `title` LIKE 'Debit: health insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o IUC' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the IUC (road tax)' OR `title` LIKE 'Pay the IUC (road tax) %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o seguro da casa' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the home insurance' OR `title` LIKE 'Pay the home insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Renovar o Cartão de Cidadão' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the Citizen Card' OR `title` LIKE 'Renew the Citizen Card %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Marcar o médico de família' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the family doctor' OR `title` LIKE 'Book the family doctor %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Inscrever nas atividades' || substr(`title`, 23), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Sign up for activities' OR `title` LIKE 'Sign up for activities %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o seguro do carro' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the car insurance' OR `title` LIKE 'Pay the car insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o condomínio' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the building fees' OR `title` LIKE 'Pay the building fees %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Mudar os lençóis' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Change the bed sheets' OR `title` LIKE 'Change the bed sheets %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: seguro da casa' || substr(`title`, 22), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: home insurance' OR `title` LIKE 'Debit: home insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: seguro do carro' || substr(`title`, 21), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: car insurance' OR `title` LIKE 'Debit: car insurance %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: condomínio' || substr(`title`, 21), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: building fees' OR `title` LIKE 'Debit: building fees %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Purgar os radiadores' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Bleed the radiators' OR `title` LIKE 'Bleed the radiators %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar a luz' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the electricity' OR `title` LIKE 'Pay the electricity %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Marcar o oftalmologista' || substr(`title`, 20), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the eye doctor' OR `title` LIKE 'Book the eye doctor %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Renovar o passaporte' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Renew the passport' OR `title` LIKE 'Renew the passport %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: luz' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: electricity' OR `title` LIKE 'Debit: electricity %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: escola ou ATL' || substr(`title`, 19), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: school fees' OR `title` LIKE 'Debit: school fees %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Limpar a chaminé' || substr(`title`, 18), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Sweep the chimney' OR `title` LIKE 'Sweep the chimney %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Limpar as caleiras' || substr(`title`, 18), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clear the gutters' OR `title` LIKE 'Clear the gutters %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Marcar o dentista' || substr(`title`, 17), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Book the dentist' OR `title` LIKE 'Book the dentist %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Regar as plantas' || substr(`title`, 17), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Water the plants' OR `title` LIKE 'Water the plants %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Limpeza da casa' || substr(`title`, 16), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Clean the house' OR `title` LIKE 'Clean the house %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Inspeção do carro' || substr(`title`, 15), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Car inspection' OR `title` LIKE 'Car inspection %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Vacina antirrábica' || substr(`title`, 15), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Rabies vaccine' OR `title` LIKE 'Rabies vaccine %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar a água' || substr(`title`, 14), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the water' OR `title` LIKE 'Pay the water %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Consulta no veterinário' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Vet check-up' OR `title` LIKE 'Vet check-up %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Aula de música' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Music lesson' OR `title` LIKE 'Music lesson %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: água' || substr(`title`, 13), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: water' OR `title` LIKE 'Debit: water %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Revisão do carro' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Car service' OR `title` LIKE 'Car service %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o gás' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the gas' OR `title` LIKE 'Pay the gas %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Pagar o ginásio' || substr(`title`, 12), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Pay the gym' OR `title` LIKE 'Pay the gym %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: IUC' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: IUC' OR `title` LIKE 'Debit: IUC %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: IMI' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: IMI' OR `title` LIKE 'Debit: IMI %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: gás' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: gas' OR `title` LIKE 'Debit: gas %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Débito: ginásio' || substr(`title`, 11), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Debit: gym' OR `title` LIKE 'Debit: gym %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Supermercado' || substr(`title`, 10), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Groceries' OR `title` LIKE 'Groceries %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Catequese' || substr(`title`, 10), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Catechism' OR `title` LIKE 'Catechism %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Natação' || substr(`title`, 9), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Swimming' OR `title` LIKE 'Swimming %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Desparasitar' || substr(`title`, 7), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Deworm' OR `title` LIKE 'Deworm %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Escuteiros' || substr(`title`, 7), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Scouts' OR `title` LIKE 'Scouts %';
--> statement-breakpoint
UPDATE `task` SET `title` = 'Ginásio' || substr(`title`, 4), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` = 'Gym' OR `title` LIKE 'Gym %';
--> statement-breakpoint
UPDATE `task` SET `title` = replace(`title`, ' (instalment 1)', ' (1.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 1)';
--> statement-breakpoint
UPDATE `task` SET `title` = replace(`title`, ' (instalment 2)', ' (2.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 2)';
--> statement-breakpoint
UPDATE `task` SET `title` = replace(`title`, ' (instalment 3)', ' (3.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 3)';
--> statement-breakpoint
UPDATE `task` SET `title` = replace(`title`, ' (instalment 4)', ' (4.ª prestação)'), `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `title` LIKE '% (instalment 4)';
--> statement-breakpoint
UPDATE `task` SET `notes` = 'Pode fazer-se nos 3 meses antes desta data.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It can be done in the 3 months before this date.';
--> statement-breakpoint
UPDATE `task` SET `notes` = 'A entrega é de 1 de abril a 30 de junho.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'The return is filed from 1 April to 30 June.';
--> statement-breakpoint
UPDATE `task` SET `notes` = 'Paga-se no Portal das Finanças.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It is paid on the Portal das Finanças.';
--> statement-breakpoint
UPDATE `task` SET `notes` = 'Paga-se no Portal das Finanças.', `changed_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `notes` = 'It is paid on the Portal das Finanças.';
