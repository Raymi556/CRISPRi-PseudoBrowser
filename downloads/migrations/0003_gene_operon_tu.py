from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("downloads", "0002_pathwayrecord"),
    ]

    operations = [
        migrations.AddField(
            model_name="gene",
            name="operon",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="gene",
            name="tu",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
