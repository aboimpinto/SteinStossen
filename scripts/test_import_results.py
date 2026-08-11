import unittest

from import_results import (
    athlete_token_key,
    canonical_series,
    classify_sex,
    parse_result_line,
    parse_weight,
)


class ImportParserTests(unittest.TestCase):
    def parse(self, line: str, category: str, **options):
        defaults = {
            "allow_bare_distances": True,
            "record_inline_attempts": False,
            "rank_at_end": False,
            "name_after_distances": False,
            "allow_unranked": False,
            "integer_centimetres": False,
        }
        defaults.update(options)
        return parse_result_line(line, category, **defaults)

    def test_name_order_deduplicates(self):
        self.assertEqual(athlete_token_key("Hutmacher Urs"), athlete_token_key("Urs Hutmacher"))

    def test_standard_ranking_row(self):
        result = self.parse("1. Hutmacher Urs, Wislig             4.82 m", "40 kg Herren")
        self.assertIsNotNone(result)
        self.assertEqual(result["raw_name"], "Hutmacher Urs")
        self.assertEqual(result["rank"], 1)
        self.assertEqual(result["best_distance_m"], 4.82)

    def test_rank_at_end_with_birth_year(self):
        result = self.parse(
            "Hunziker       Simon       Herznach       1982       3.60       3.68       3.68    4",
            "Herren 67 kg",
            rank_at_end=True,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["raw_name"], "Hunziker Simon")
        self.assertEqual(result["birth_year"], 1982)
        self.assertEqual(result["rank"], 4)

    def test_distances_before_name(self):
        result = self.parse(
            "1    8.31 8.26 7.91 Urs            Hutmacher      Wislig",
            "20 kg Herren",
            name_after_distances=True,
        )
        self.assertIsNotNone(result)
        self.assertEqual(athlete_token_key(result["raw_name"]), athlete_token_key("Hutmacher Urs"))
        self.assertEqual(result["best_distance_m"], 8.31)

    def test_integer_centimetres(self):
        result = self.parse(
            "1 Michel Peter Interlaken 407",
            "Gedenksteinstossen",
            allow_bare_distances=False,
            integer_centimetres=True,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["best_distance_m"], 4.07)

    def test_category_dimensions(self):
        self.assertEqual(classify_sex("Damen Offen 12,5 kg", 12.5), "female")
        self.assertEqual(classify_sex("Herren 40 kg", 40), "male")
        self.assertEqual(parse_weight("Unspunnenstein 83.5 kg"), 83.5)
        self.assertEqual(canonical_series("Stoosschwinget 2025"), "Stoosschwinget")


if __name__ == "__main__":
    unittest.main()
